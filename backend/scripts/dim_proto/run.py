"""CLI runner for the 6-dimension evaluation prototype."""
import argparse
import json
import os
import sys
from pathlib import Path

# Add backend to sys.path to allow imports from app
sys.path.append(str(Path(__file__).resolve().parent.parent.parent))

from app.services.llm_client import call_llm
from scripts.dim_proto.prompts import (
    SYS_DIM_CONFLICT, 
    SYS_DIM_USER_SCORE, 
    user_prompt_dim_conflict, 
    user_prompt_dim_user_score
)
from scripts.dim_proto.aggregate import aggregate_scores

def main():
    parser = argparse.ArgumentParser(description="6-Dimension Evaluation Prototype")
    parser.add_argument("--profiles", type=str, required=True, help="Path to profiles JSON")
    parser.add_argument("--proposal", type=str, required=True, help="Path to proposal JSON")
    parser.add_argument("--out", type=str, default="scripts/dim_proto/output", help="Output directory")
    args = parser.parse_args()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    # 1. Load Data
    print(f"[*] Loading data from {args.profiles} and {args.proposal}...")
    with open(args.profiles, 'r', encoding='utf-8') as f:
        profiles_data = json.load(f)
    with open(args.proposal, 'r', encoding='utf-8') as f:
        proposal_data = json.load(f)

    profiles = profiles_data.get("profiles", [])
    # Handle both wrapped and unwrapped proposal
    proposal = proposal_data.get("proposal", proposal_data)

    # 2. Step 1: Dimension Conflict Analysis
    print("[*] Running Step 1: Dimension Conflict Analysis (LLM)...")
    conflict_result = call_llm(
        system=SYS_DIM_CONFLICT,
        user=user_prompt_dim_conflict(profiles),
        mock_file="conflict_dim_fallback.json", # Not actually used if force_real=True
        force_real=True
    )
    with open(out_dir / "conflict_dim.json", 'w', encoding='utf-8') as f:
        json.dump(conflict_result, f, ensure_ascii=False, indent=2)

    # 3. Step 2: Dimension User Scoring
    print("[*] Running Step 2: Dimension User Scoring (LLM)...")
    user_score_result = call_llm(
        system=SYS_DIM_USER_SCORE,
        user=user_prompt_dim_user_score(profiles, proposal, conflict_result),
        mock_file="user_dim_scores_fallback.json",
        force_real=True
    )
    with open(out_dir / "user_dim_scores.json", 'w', encoding='utf-8') as f:
        json.dump(user_score_result, f, ensure_ascii=False, indent=2)

    # 4. Step 3: Aggregation
    print("[*] Running Step 3: Aggregation (Python)...")
    final_report = aggregate_scores(profiles, proposal, conflict_result, user_score_result)
    with open(out_dir / "aggregated.json", 'w', encoding='utf-8') as f:
        json.dump(final_report, f, ensure_ascii=False, indent=2)

    # 5. Print Report
    print("\n" + "="*60)
    print(" 6-DIMENSION EVALUATION REPORT ")
    print("="*60)
    print(f"STATUS: {final_report['status']}")
    print(f"REASONS: {', '.join(final_report['status_reasons']) if final_report['status_reasons'] else 'None'}")
    print(f"FINAL GROUP SCORE: {final_report['final_group_score']}")
    print("-" * 60)
    print("METRICS:")
    for k, v in final_report['metrics'].items():
        print(f"  - {k:25}: {v}")
    
    print("-" * 60)
    print("PER USER SATISFACTION:")
    for user in final_report['per_user']:
        print(f"  User {user['user_id']}: {user['final_satisfaction']} (Base: {user['base_score']}, Penalty: -{user['penalties']})")
        if user['penalty_details']:
            print(f"    Penalties: {', '.join(user['penalty_details'])}")
        if user['must_have_missing']:
            print(f"    MISSING MUST-HAVES: {', '.join(user['must_have_missing'])}")

    print("-" * 60)
    print("DIMENSION CONFLICTS (LLM Step 1):")
    for dc in conflict_result.get("dimension_conflicts", []):
        print(f"  [{dc['dim_key']}] {dc['dimension']:20} Score: {dc['overall_score']} ({dc['tier']})")
        print(f"      Summary: {dc['summary']}")

    print("="*60)
    print(f"Full results saved to {out_dir}/")

if __name__ == "__main__":
    main()
