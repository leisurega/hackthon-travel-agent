"""Evaluation pipeline for Travel Coordination Agent.

Layers:
- Layer A: Python-based quantification (intensity, budget, dietary)
- Layer B: LLM-based semantic evaluation (handled in evaluator_agent.py)
- Layer C: Python-based aggregation and status determination
"""
from __future__ import annotations

import statistics
import re
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from .state import TripState, UserProfile


def within_open_window(time_str: str, open_time: Dict[str, str], pre_minutes: int = 30) -> bool:
    """Check if time_str is within [start, end] of open_time, allowing for pre_minutes arrival."""
    try:
        # Normalize time_str (HH:MM)
        t = datetime.strptime(time_str, "%H:%M")
        start = datetime.strptime(open_time["start"], "%H:%M")
        end = datetime.strptime(open_time["end"], "%H:%M")
        
        # Allow arriving pre_minutes before opening
        effective_start = start - timedelta(minutes=pre_minutes)
        
        # If end < start, it means it's open overnight (e.g. 10:00 - 02:00)
        if end < start:
            return t >= effective_start or t <= end
        
        return effective_start <= t <= end
    except Exception:
        return True # Default to true if format is weird


def analyze_time_window(proposal: Dict[str, Any], poi_pool: Dict[str, List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
    violations = []
    per_day = proposal.get("per_day", [])
    
    # Flatten poi_pool for quick lookup
    flat_pool = {}
    for city_pois in poi_pool.values():
        for p in city_pois:
            pid = p.get("poi_id") or p.get("name")
            if pid:
                flat_pool[pid] = p

    for day_plan in per_day:
        day_idx = day_plan.get("day", 1)
        for slot in ["morning", "lunch", "afternoon", "dinner", "night"]:
            activity = day_plan.get(slot)
            if not activity: continue
            
            poi_id = activity.get("poi_id")
            if not poi_id: continue
            
            poi = flat_pool.get(poi_id)
            if not poi: continue
            
            open_time = poi.get("open_time")
            if not open_time or not isinstance(open_time, dict): continue
            
            act_time = activity.get("time")
            if not act_time: continue
            
            if not within_open_window(act_time, open_time):
                violations.append({
                    "user_id": "all", # Time window is a group-level hard constraint
                    "day": day_idx,
                    "slot": slot,
                    "activity": activity.get("title"),
                    "poi_id": poi_id,
                    "act_time": act_time,
                    "open_window": f"{open_time['start']}-{open_time['end']}",
                    "type": "time_window_violation"
                })
    return violations


def analyze_intensity(proposal: Dict[str, Any], profiles: List[UserProfile]) -> List[Dict[str, Any]]:
    violations = []
    per_day = proposal.get("per_day", [])
    
    for user in profiles:
        uid = user["user_id"]
        limit = user.get("hard_constraints", {}).get("walk_km_max", 10.0)
        
        for day_idx, day_plan in enumerate(per_day):
            daily_km = 0.0
            contributing_pois = []
            
            # Sum up km for all activities in the day
            for slot in ["morning", "lunch", "afternoon", "dinner", "night"]:
                activity = day_plan.get(slot)
                if not activity: continue
                
                # In production, we'd look up the POI metadata from the pool
                # For now, we assume the generator might have put it in or we look it up
                # (In our system, POIs in the pool have walk_km_estimate)
                # Here we simulate the lookup from a flattened pool
                poi_id = activity.get("poi_id")
                # This is a simplification; in reality we'd have the state["poi_pool"]
                # For the sake of the node, we'll assume the km is available or use a default
                km = activity.get("walk_km_estimate", 0.5) 
                daily_km += km
                if km > 0:
                    contributing_pois.append(activity.get("title", "Unknown"))
            
            if daily_km > limit:
                violations.append({
                    "user_id": uid,
                    "day": day_idx + 1,
                    "actual_km": round(daily_km, 2),
                    "limit_km": limit,
                    "contributing_pois": contributing_pois
                })
    return violations

def analyze_budget(proposal: Dict[str, Any], profiles: List[UserProfile]) -> List[Dict[str, Any]]:
    violations = []
    per_day = proposal.get("per_day", [])
    
    # Calculate per-user total cost
    user_costs = {u["user_id"]: 0.0 for u in profiles}
    
    for day_plan in per_day:
        for slot in ["morning", "lunch", "afternoon", "dinner", "night"]:
            activity = day_plan.get(slot)
            if not activity: continue
            
            cost = activity.get("cost", 0)
            beneficiaries = activity.get("beneficiaries", [])
            
            if not beneficiaries:
                # Split among all if no beneficiaries listed
                share = cost / len(profiles)
                for uid in user_costs:
                    user_costs[uid] += share
            else:
                share = cost / len(beneficiaries)
                for uid in beneficiaries:
                    if uid in user_costs:
                        user_costs[uid] += share
    
    for user in profiles:
        uid = user["user_id"]
        limit = user.get("hard_constraints", {}).get("budget_max", 10000)
        actual = user_costs[uid]
        
        if actual > limit:
            violations.append({
                "user_id": uid,
                "actual_budget": round(actual, 2),
                "limit_budget": limit
            })
    return violations

def analyze_dietary_safety(proposal: Dict[str, Any], profiles: List[UserProfile]) -> List[Dict[str, Any]]:
    violations = []
    per_day = proposal.get("per_day", [])
    
    for user in profiles:
        uid = user["user_id"]
        # In v2, anti_preferences is a dict with weights
        antis = user.get("anti_preferences", {})
        # We look for high-weight anti-prefs that are dietary
        must_not_diet = [k for k, v in antis.items() if v >= 0.9] 
        # Also check hard_constraints
        must_not_diet.extend(user.get("hard_constraints", {}).get("dietary", []))
        
        if not must_not_diet: continue
        
        for day_idx, day_plan in enumerate(per_day):
            for slot in ["lunch", "dinner"]:
                meal = day_plan.get(slot)
                if not meal: continue
                
                # Check tags of the meal POI
                tags = meal.get("tags", [])
                for forbidden in must_not_diet:
                    if forbidden in tags:
                        violations.append({
                            "user_id": uid,
                            "day": day_idx + 1,
                            "meal": meal.get("title"),
                            "forbidden_item": forbidden
                        })
    return violations

# ---------------------------------------------------------------------------
# Layer C: Aggregation
# ---------------------------------------------------------------------------

def aggregate_scores(
    state: TripState, 
    llm_scores: Dict[str, Any], 
    hard_violations: List[Dict[str, Any]]
) -> Dict[str, Any]:
    profiles = state.get("profiles", [])
    per_user_results = []
    s_values = []
    
    day_states = llm_scores.get("day_states", {})
    highlight_counts = llm_scores.get("highlight_count", {})
    
    # Map user_id to their hard violations
    user_violations = {}
    for v in hard_violations:
        uid = v["user_id"]
        if uid not in user_violations: user_violations[uid] = []
        user_violations[uid].append(v)

    for user_data in llm_scores.get("per_user_scores", []):
        uid = user_data["user_id"]
        profile = next((p for p in profiles if p["user_id"] == uid), None)
        if not profile: continue
        
        # 1. Base Weighted Score using user's own weights
        weights = profile.get("scoring_weights", {"T": 0.15, "B": 0.15, "P": 0.20, "I": 0.25, "F": 0.15, "S": 0.10})
        base_score = sum(user_data.get(k, 0) * weights.get(k, 0) for k in ["T", "B", "P", "I", "F", "S"])
        
        # 2. Penalties
        penalties = 0
        penalty_details = []
        
        # Continuous compromise
        states = day_states.get(uid, [])
        streak = 0
        max_streak = 0
        for s in states:
            if s == "妥协":
                streak += 1
                max_streak = max(max_streak, streak)
            else:
                streak = 0
        if max_streak >= 2:
            penalties += 15
            penalty_details.append("连续妥协 ≥2 天 (-15)")
            
        # No highlight
        if highlight_counts.get(uid, 0) == 0:
            penalties += 10
            penalty_details.append("全程无高光 (-10)")
            
        # Hard violations (Layer A)
        if uid in user_violations:
            penalties += 50 # Heavy penalty for hard violations
            penalty_details.append(f"存在 {len(user_violations[uid])} 项硬约束违反 (-50)")
            
        final_user_score = max(0, base_score - penalties)
        if uid in user_violations:
            final_user_score = 0 # Force 0 if hard violation exists
            
        s_values.append(final_user_score)
        per_user_results.append({
            "user_id": uid,
            "display_name": profile.get("display_name"),
            "base_score": round(base_score, 2),
            "penalties": penalties,
            "penalty_details": penalty_details,
            "final_satisfaction": round(final_user_score, 2),
            "dimensions": {k: user_data.get(k) for k in ["T", "B", "P", "I", "F", "S"]},
            "evidence": user_data.get("evidence", {})
        })

    # Group Metrics
    s_avg = statistics.mean(s_values) if s_values else 0
    s_min = min(s_values) if s_values else 0
    
    # Fairness (simplified)
    fairness = 100 - (max(s_values) - min(s_values)) if s_values else 100
    
    final_group_score = (0.4 * s_avg + 0.4 * s_min + 0.2 * fairness)
    
    # Status
    status = "Pass"
    reasons = []
    if hard_violations:
        status = "Reject"
        reasons.append("存在硬约束违反")
    elif s_min < 60:
        status = "Reject"
        reasons.append(f"最低个人满意度({round(s_min,1)})低于 60")
    elif s_min < 70:
        status = "HumanReview"
        reasons.append("最低个人满意度处于人工审核区间")

    return {
        "final_group_score": round(final_group_score, 2),
        "status": status,
        "status_reasons": reasons,
        "metrics": {
            "s_avg": round(s_avg, 2),
            "s_min": round(s_min, 2),
            "fairness": round(fairness, 2),
            "execution_efficiency": 90, # Placeholder
            "robustness": 85 # Placeholder
        },
        "per_user": per_user_results
    }

def run_evaluation_pipeline(state: TripState, llm_scores: Dict[str, Any]) -> Dict[str, Any]:
    proposal = state.get("proposal", {})
    profiles = state.get("profiles", [])
    
    # 0. Empty proposal check
    if not proposal or not proposal.get("per_day"):
        return {
            "final_group_score": 0,
            "status": "Reject",
            "status_reasons": ["方案为空（POI 池不足或 LLM 未输出每日安排）"],
            "metrics": {
                "s_avg": 0,
                "s_min": 0,
                "fairness": 0,
                "execution_efficiency": 0,
                "robustness": 0
            },
            "per_user": [],
            "hard_violations": [],
            "compensation_audit": [],
            "compensation_metric": None
        }

    # 1. Layer A: Quantification
    v_intensity = analyze_intensity(proposal, profiles)
    v_budget = analyze_budget(proposal, profiles)
    v_diet = analyze_dietary_safety(proposal, profiles)
    v_time = analyze_time_window(proposal, state.get("poi_pool", {}))
    hard_violations = v_intensity + v_budget + v_diet + v_time
    
    # 2. Layer C: Aggregation
    report = aggregate_scores(state, llm_scores, hard_violations)
    
    # 3. Add drill-downs
    report["hard_violations"] = hard_violations
    report["compensation_audit"] = llm_scores.get("compensation_audit", [])
    
    # Compensation metric
    audit = report["compensation_audit"]
    if audit:
        total = len(audit)
        fulfilled = sum(1 for a in audit if a.get("fulfillment") == "fulfilled")
        partial = sum(1 for a in audit if a.get("fulfillment") == "partial")
        report["compensation_metric"] = {
            "fulfilled_pct": round(fulfilled / total * 100, 1),
            "partial_pct": round(partial / total * 100, 1),
            "missed_pct": round((total - fulfilled - partial) / total * 100, 1)
        }
    else:
        report["compensation_metric"] = None
        
    return report
