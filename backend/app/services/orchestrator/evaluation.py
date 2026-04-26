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
            
            start = activity.get("start_time") or activity.get("time")
            end = activity.get("end_time") or start # Fallback to start if end is missing
            
            if not start: continue
            
            # Check if both start and end are within open window
            start_ok = within_open_window(start, open_time)
            end_ok = within_open_window(end, open_time)
            
            if not start_ok or not end_ok:
                violations.append({
                    "user_id": "all", # Time window is a group-level hard constraint
                    "day": day_idx,
                    "slot": slot,
                    "activity": activity.get("title"),
                    "poi_id": poi_id,
                    "act_time": f"{start}-{end}" if start != end else start,
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
                # (In our system, POIs in the pool have visit_walk_km)
                # Here we simulate the lookup from a flattened pool
                poi_id = activity.get("poi_id")
                # This is a simplification; in reality we'd have the state["poi_pool"]
                # For the sake of the node, we'll assume the km is available or use a default
                km = activity.get("visit_walk_km") or activity.get("walk_km_estimate", 0.5) 
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

def analyze_lifestyle(proposal: Dict[str, Any], profiles: List[UserProfile]) -> List[Dict[str, Any]]:
    """Lifestyle preference checks. All entries carry `severity` field:
    - hard: must-satisfy structural requirements (e.g. explicit highlight count)
    - soft: lifestyle preferences (early start, late rest, golden-hour photography)
    """
    violations = []
    per_day = proposal.get("per_day", [])
    
    for user in profiles:
        uid = user["user_id"]
        hc = user.get("hard_constraints", {})
        latest_rest = hc.get("latest_rest_time")
        no_early = hc.get("no_consecutive_early_start")
        must_highlight = hc.get("must_have_highlight_slots")
        sp = user.get("strong_preferences", {})
        wants_golden = sp.get("photography_golden_hour", 0) >= 0.7
        
        early_start_count = 0
        highlight_count = 0
        golden_hour_met = False
        
        for day_idx, day_plan in enumerate(per_day):
            # 1. latest_rest_time -> SOFT (judge by end_time, skip overnight scenarios)
            night = day_plan.get("night")
            if night and latest_rest:
                end_str = night.get("end_time") or night.get("time")
                if end_str:
                    try:
                        et = datetime.strptime(end_str, "%H:%M")
                        lt = datetime.strptime(latest_rest, "%H:%M")
                        # Skip overnight-friendly profiles (latest_rest <= 06:00 means they accept late nights)
                        if lt.hour > 6 and et > lt:
                            violations.append({
                                "user_id": uid,
                                "day": day_idx + 1,
                                "type": "rest_time_violation",
                                "severity": "soft",
                                "evidence": f"夜间活动结束时间 {end_str} 晚于最晚休息 {latest_rest}"
                            })
                    except Exception:
                        pass

            # 2. no_consecutive_early_start -> SOFT
            morning = day_plan.get("morning")
            if morning:
                start_str = morning.get("start_time") or morning.get("time") or "09:00"
                if start_str < "09:00":
                    early_start_count += 1
                else:
                    early_start_count = 0
                
                if no_early and early_start_count >= 2:
                    violations.append({
                        "user_id": uid,
                        "day": day_idx + 1,
                        "type": "consecutive_early_start_violation",
                        "severity": "soft",
                        "evidence": "连续两天早于 09:00 出发"
                    })

            # 3. must_have_highlight_slots (count) - HARD if explicitly set
            # 4. photography_golden_hour (17:00-19:00) - SOFT (from strong_preferences)
            for slot in ["morning", "lunch", "afternoon", "dinner", "night"]:
                act = day_plan.get(slot)
                if not act: continue
                
                # Check highlight (beneficiaries list)
                if uid in act.get("beneficiaries", []):
                    highlight_count += 1
                
                # Check golden hour (afternoon or dinner usually covers 17-19)
                start_str = act.get("start_time") or act.get("time") or ""
                if wants_golden and not golden_hour_met:
                    # Heuristic: if it's afternoon and starts after 15:00 or dinner starts before 19:00
                    if (slot == "afternoon" and start_str >= "15:00") or (slot == "dinner" and start_str <= "19:00"):
                        golden_hour_met = True

        # Final checks after all days
        if must_highlight and isinstance(must_highlight, int) and highlight_count < must_highlight:
             violations.append({
                "user_id": uid,
                "type": "insufficient_highlights_violation",
                "severity": "hard",
                "evidence": f"全程高光活动数 {highlight_count} 低于要求 {must_highlight}"
            })
        
        if wants_golden and not golden_hour_met:
            violations.append({
                "user_id": uid,
                "type": "golden_hour_missed_violation",
                "severity": "soft",
                "evidence": "全程未安排黄金时段摄影独立时段"
            })
            
    return violations


def aggregate_scores(
    state: TripState, 
    llm_scores: Dict[str, Any], 
    hard_violations: List[Dict[str, Any]],
    soft_violations: List[Dict[str, Any]] = None
) -> Dict[str, Any]:
    profiles = state.get("profiles", [])
    per_user_results = []
    s_values = []
    soft_violations = soft_violations or []
    
    day_states = llm_scores.get("day_states", {})
    highlight_counts = llm_scores.get("highlight_count", {})
    
    # Group hard violations by user_id; "all" violations are tracked separately
    user_hard = {}
    group_hard = []
    for v in hard_violations:
        uid = v.get("user_id")
        if uid == "all":
            group_hard.append(v)
        elif uid:
            user_hard.setdefault(uid, []).append(v)

    # Group soft violations by user_id
    user_soft = {}
    for v in soft_violations:
        uid = v.get("user_id")
        if uid and uid != "all":
            user_soft.setdefault(uid, []).append(v)

    # Group-level penalty (applied to every user) for "all" violations like time_window
    # Each "all" violation deducts 8 from every user, capped at 20
    group_penalty = min(20, 8 * len(group_hard)) if group_hard else 0

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
            
        # Hard violations: tiered penalty (1=-25, 2=-35, 3+=-40)
        hard_count = len(user_hard.get(uid, []))
        if hard_count > 0:
            hard_penalty = min(40, 25 + 10 * (hard_count - 1))
            penalties += hard_penalty
            penalty_details.append(f"硬违反 {hard_count} 项 (-{hard_penalty})")

        # Soft violations: capped at 15 (5 per item)
        soft_count = len(user_soft.get(uid, []))
        if soft_count > 0:
            soft_penalty = min(15, 5 * soft_count)
            penalties += soft_penalty
            penalty_details.append(f"软偏好未满足 {soft_count} 项 (-{soft_penalty})")

        # Group-level penalty (e.g. time_window violations affecting all)
        if group_penalty > 0:
            penalties += group_penalty
            penalty_details.append(f"全组共享违反 (-{group_penalty})")
            
        final_user_score = max(0, base_score - penalties)
        # No more force-zero — penalty cap already protects the floor
            
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
    
    # Re-tuned formula: avoid single low-score user from collapsing the whole plan
    final_group_score = (0.5 * s_avg + 0.25 * s_min + 0.25 * fairness)
    
    # Status: only severity=hard hard_violations push to Reject; otherwise HumanReview/Pass
    status = "Pass"
    reasons = []
    real_hard = [v for v in hard_violations if v.get("severity", "hard") == "hard"]
    if real_hard:
        status = "Reject"
        reasons.append(f"存在 {len(real_hard)} 条硬约束违反")
    elif s_min < 40:
        status = "Reject"
        reasons.append(f"最低个人满意度({round(s_min,1)}) 低于 40 (不可接受)")
    elif s_min < 60 or final_group_score < 70:
        status = "HumanReview"
        if s_min < 60:
            reasons.append(f"最低个人满意度({round(s_min,1)}) 处于人工审核区间")
        if final_group_score < 70:
            reasons.append(f"团队总分({round(final_group_score,1)}) 低于 70")

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
            "soft_violations": [],
            "compensation_audit": [],
            "compensation_metric": None
        }

    # 1. Layer A: Quantification
    # Strict-hard: intensity, budget, diet, time_window (default severity=hard)
    v_intensity = [{**v, "severity": "hard", "type": v.get("type", "intensity_violation")} for v in analyze_intensity(proposal, profiles)]
    v_budget = [{**v, "severity": "hard", "type": v.get("type", "budget_violation")} for v in analyze_budget(proposal, profiles)]
    v_diet = [{**v, "severity": "hard", "type": v.get("type", "dietary_violation")} for v in analyze_dietary_safety(proposal, profiles)]
    v_time = analyze_time_window(proposal, state.get("poi_pool", {}))  # already has severity in modified version below
    v_time = [{**v, "severity": "hard"} for v in v_time]
    
    # Mixed-severity: lifestyle (already carries `severity` field per item)
    v_lifestyle = analyze_lifestyle(proposal, profiles)
    
    # Split into hard / soft
    all_violations = v_intensity + v_budget + v_diet + v_time + v_lifestyle
    hard_violations = [v for v in all_violations if v.get("severity", "hard") == "hard"]
    soft_violations = [v for v in all_violations if v.get("severity", "hard") == "soft"]
    
    # 2. Layer C: Aggregation
    report = aggregate_scores(state, llm_scores, hard_violations, soft_violations)
    
    # 3. Add drill-downs
    report["hard_violations"] = hard_violations
    report["soft_violations"] = soft_violations
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
