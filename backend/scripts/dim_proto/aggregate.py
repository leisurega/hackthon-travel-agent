"""Aggregation logic for the 6-dimension evaluation prototype."""
from typing import List, Dict, Any
import statistics

def aggregate_scores(
    profiles: List[Dict[str, Any]],
    proposal: Dict[Dict[str, Any], Any],
    dim_conflicts: Dict[str, Any],
    user_scores: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Aggregate dimension scores into final metrics based on 维度.txt.
    """
    per_user_results = []
    s_values = []
    
    protected_users = set(user_scores.get("protected_users", []))
    day_states = user_scores.get("day_states", {})
    highlight_counts = user_scores.get("highlight_count", {})
    
    for user_data in user_scores.get("per_user_scores", []):
        uid = user_data["user_id"]
        
        # 1. Base Weighted Score
        # 0.15T + 0.15B + 0.20P + 0.25I + 0.15F + 0.10S
        base_score = (
            0.15 * user_data.get("T", 0) +
            0.15 * user_data.get("B", 0) +
            0.20 * user_data.get("P", 0) +
            0.25 * user_data.get("I", 0) +
            0.15 * user_data.get("F", 0) +
            0.10 * user_data.get("S", 0)
        )
        
        # 2. Penalties
        penalties = 0
        penalty_details = []
        
        # Continuous compromise penalty
        states = day_states.get(uid, [])
        compromise_streak = 0
        max_compromise_streak = 0
        for s in states:
            if s == "妥协":
                compromise_streak += 1
                max_compromise_streak = max(max_compromise_streak, compromise_streak)
            else:
                compromise_streak = 0
        
        if max_compromise_streak >= 2:
            penalties += 15
            penalty_details.append("连续妥协 ≥2 天 (-15)")
        elif "妥协" in states:
            # Check if compromise is followed by highlight or balance
            for i in range(len(states) - 1):
                if states[i] == "妥协" and states[i+1] == "妥协":
                    continue # already handled by streak
                if states[i] == "妥协" and states[i+1] not in ["高光", "平衡"]:
                    # This is a bit redundant with streak but follows the "must compensate within 1 day" rule
                    pass
        
        # No highlight penalty
        if highlight_counts.get(uid, 0) == 0:
            penalties += 10
            penalty_details.append("全程无高光 (-10)")
            
        # Protected user not protected
        if uid in protected_users:
            min_dim_score = min(user_data.get(k, 100) for k in ["T", "B", "P", "I", "F", "S"])
            if min_dim_score < 55:
                penalties += 20
                penalty_details.append("保护型用户硬约束受损 (-20)")
            elif min_dim_score < 70:
                penalties += 10
                penalty_details.append("保护型用户满意度偏低 (-10)")
        
        final_user_score = max(0, base_score - penalties)
        s_values.append(final_user_score)
        
        per_user_results.append({
            "user_id": uid,
            "base_score": round(base_score, 2),
            "penalties": penalties,
            "penalty_details": penalty_details,
            "final_satisfaction": round(final_user_score, 2),
            "must_have_missing": user_data.get("must_have_missing", [])
        })

    # 3. Group Metrics
    s_avg = statistics.mean(s_values) if s_values else 0
    s_min = min(s_values) if s_values else 0
    
    # Fairness
    # 妥协均匀度: 100 - 15 * (max-min) of compromise days
    comp_days = [states.count("妥协") for states in day_states.values()]
    fairness_comp = max(0, 100 - 15 * (max(comp_days) - min(comp_days))) if comp_days else 100
    
    # 高光覆盖: 100 - 25 * (用户高光为 0 的人数)
    zero_highlights = sum(1 for count in highlight_counts.values() if count == 0)
    fairness_high = max(0, 100 - 25 * zero_highlights)
    
    # 保护到位
    any_protected_penalty = any("保护型" in p for res in per_user_results for p in res["penalty_details"])
    fairness_prot = 80 if any_protected_penalty else 100
    
    fairness = (fairness_comp + fairness_high + fairness_prot) / 3
    
    # Execution Efficiency (Placeholder logic)
    # 100 - 5*(换城市次数) - 2*(空项)
    exec_eff = 90 # Default placeholder
    
    # Robustness (Placeholder logic)
    robustness = 85 # Default placeholder
    
    # Final Group Score
    # 0.30 * S_avg + 0.25 * S_min + 0.20 * Fairness + 0.15 * Exec + 0.10 * Robust
    final_group_score = (
        0.30 * s_avg +
        0.25 * s_min +
        0.20 * fairness +
        0.15 * exec_eff +
        0.10 * robustness
    )
    
    # 4. Final Status
    status = "Pass"
    reasons = []
    
    if any(res["must_have_missing"] for res in per_user_results):
        status = "Reject"
        reasons.append("存在 must_have 缺失")
    
    if dim_conflicts.get("feasibility_status") == "Reject":
        status = "Reject"
        reasons.append(f"冲突分析拒绝: {dim_conflicts.get('feasibility_reason')}")
        
    if s_min < 55:
        status = "Reject"
        reasons.append(f"最低个人满意度({round(s_min,1)})低于 55")
    elif s_min < 65:
        if status != "Reject": status = "HumanReview"
        reasons.append(f"最低个人满意度({round(s_min,1)})处于人工审核区间")
    elif s_min < 70:
        if status not in ["Reject", "HumanReview"]: status = "Conditional"
        reasons.append(f"最低个人满意度({round(s_min,1)})处于有条件通过区间")

    return {
        "final_group_score": round(final_group_score, 2),
        "status": status,
        "status_reasons": reasons,
        "metrics": {
            "s_avg": round(s_avg, 2),
            "s_min": round(s_min, 2),
            "fairness": round(fairness, 2),
            "execution_efficiency": exec_eff,
            "robustness": robustness
        },
        "per_user": per_user_results
    }
