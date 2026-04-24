"""Scoring engine.

Real implementation of the per-user satisfaction formula documented by P3:

    F        = 100 - 10 * hard_conflicts
    S_i      = clamp(100 - 5*len(gave_up) + 3*len(met) - 2*len(anti_pref_hit), 0, 100)
    S_avg    = mean(S_i)
    S_min    = min(S_i)
    Fairness = 100 - 3 * (max(S_i) - min(S_i))
    final    = 0.25*F + 0.25*S_avg + 0.35*S_min + 0.15*Fairness

Signature contract preserved:
    score(proposal, profiles, conflicts=None, is_replan=False) -> Score dict

`met`, `gave_up`, `compensation` are filled with human-readable strings so
`explainer_agent` (and the frontend) can show them directly.
"""
from __future__ import annotations

from statistics import mean
from typing import Any, Dict, Iterable, List, Optional, Set, Tuple


# ---------------------------------------------------------------------------
# Tag expansion map: trip_goal (coarse) -> activity tag synonyms (fine)
# ---------------------------------------------------------------------------

GOAL_TAG_MAP: Dict[str, Set[str]] = {
    "放松": {"放松", "休闲", "山水", "夜景", "自由"},
    "美食": {"美食", "餐厅", "老字号", "小吃", "京菜", "本帮菜", "杭帮菜", "农家菜"},
    "摄影": {"拍照", "摄影", "黄金时段", "浪漫", "地标"},
    "博物馆": {"博物馆", "艺术"},
    "购物": {"购物"},
    "深度文化": {"深度文化", "历史", "文化", "艺术", "老北京"},
}


def _expand_goals(trip_goal: List[str]) -> Set[str]:
    out: Set[str] = set()
    for g in trip_goal or []:
        out |= GOAL_TAG_MAP.get(g, {g})
    return out


def _anti_pref_tokens(anti: List[str]) -> Set[str]:
    """Expand anti_preferences keywords to searchable tokens."""
    mapping: Dict[str, Set[str]] = {
        "高密度行程": {"高密度", "打卡"},
        "购物": {"购物"},
        "博物馆": {"博物馆"},
        "高强度步行": {"长城", "户外", "徒步"},
        "夜生活": {"夜店", "酒吧"},
    }
    out: Set[str] = set()
    for a in anti or []:
        out |= mapping.get(a, {a})
    return out


def _iter_activities(proposal: Dict[str, Any]) -> Iterable[Tuple[int, str, Dict[str, Any]]]:
    for day_plan in proposal.get("per_day", []) or []:
        d = day_plan.get("day", 0)
        for slot in ("morning", "noon", "evening"):
            block = day_plan.get(slot)
            if not block or not block.get("title"):
                continue
            yield d, slot, block


# ---------------------------------------------------------------------------
# Per-user analysis
# ---------------------------------------------------------------------------


def _analyze_user(
    profile: Dict[str, Any],
    proposal: Dict[str, Any],
    days: int,
) -> Tuple[List[str], List[str], List[str], int, int]:
    """Return (met, gave_up, compensation, anti_hits, hard_violations) for one user."""
    uid = profile.get("user_id", "?")
    trip_goal = profile.get("trip_goal", []) or []
    goal_tokens = _expand_goals(trip_goal)
    anti_tokens = _anti_pref_tokens(profile.get("anti_preferences", []))
    budget_cap = int((profile.get("hard_constraints") or {}).get("budget_cap") or 0)

    # Per goal hit counter (how many activities hit each trip_goal)
    goal_hit: Dict[str, int] = {g: 0 for g in trip_goal}
    # Met activities (user is beneficiary AND tags match trip goal)
    met: List[str] = []
    met_seen: Set[str] = set()
    anti_hits = 0
    anti_hit_notes: List[str] = []
    total_cost = 0

    for d, _, block in _iter_activities(proposal):
        tags = set(block.get("tags") or [])
        title = block.get("title", "")
        bens = set(block.get("beneficiaries") or [])
        cost = int(block.get("cost") or 0)
        total_cost += cost

        tokens = tags | {title}

        for g in trip_goal:
            g_tokens = GOAL_TAG_MAP.get(g, {g})
            if tags & g_tokens:
                goal_hit[g] += 1
                if uid in bens and title not in met_seen and len(met) < 3:
                    met.append(f"Day {d} {title}（命中「{g}」）")
                    met_seen.add(title)

        if anti_tokens & tokens:
            anti_hits += 1
            if len(anti_hit_notes) < 2:
                anti_hit_notes.append(f"Day {d} {title}")

    # Fallback met: if user is beneficiary but no trip_goal match yet, still record it
    if not met:
        for d, _, block in _iter_activities(proposal):
            if uid in set(block.get("beneficiaries") or []) and len(met) < 2:
                met.append(f"Day {d} {block.get('title', '')}")

    # Gave-up: trip_goal hit less than 2 across the whole proposal
    gave_up: List[str] = []
    for g, cnt in goal_hit.items():
        if cnt < 2:
            gave_up.append(f"「{g}」仅 {cnt} 次命中，低于期望")

    # Hard-constraint violations for this user
    hard_violations = 0
    if budget_cap and total_cost > budget_cap:
        hard_violations += 1
        gave_up.append(f"总花费 {total_cost} 超过预算 {budget_cap}")

    # Compensation heuristics
    compensation: List[str] = []
    if anti_hits <= 1 and anti_tokens:
        anti_names = "、".join(profile.get("anti_preferences", [])[:2])
        compensation.append(f"系统基本避免了你的雷点：{anti_names}")
    # If a specific slot has photography_golden_hour tag and user prefers 摄影 -> compensation
    for g, cnt in goal_hit.items():
        if cnt >= 3:
            compensation.append(f"「{g}」累计命中 {cnt} 次，覆盖充分")
            break
    if not compensation:
        compensation.append(f"人均预算约 {proposal.get('per_person_per_day', 0)}/天，节奏可控")

    return met, gave_up, compensation, anti_hits, hard_violations


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def score(
    proposal: Dict[str, Any],
    profiles: List[Dict[str, Any]],
    conflicts: Optional[List[Dict[str, Any]]] = None,
    is_replan: bool = False,
) -> Dict[str, Any]:
    days = int(proposal.get("city_days") and sum(proposal["city_days"]) or len(proposal.get("per_day", []) or []) or 7)

    hard_conflict_count = sum(1 for c in (conflicts or []) if c.get("is_hard"))

    per_user: List[Dict[str, Any]] = []
    s_values: List[int] = []
    total_hard_violations = 0

    for p in profiles or []:
        met, gave_up, compensation, anti_hits, hard_violations = _analyze_user(p, proposal, days)
        total_hard_violations += hard_violations

        s_i = 100 - 5 * len(gave_up) + 3 * len(met) - 2 * anti_hits
        s_i = max(0, min(100, s_i))
        s_values.append(s_i)

        per_user.append(
            {
                "user_id": p.get("user_id"),
                "satisfaction": s_i,
                "met": met,
                "gave_up": gave_up,
                "compensation": compensation,
            }
        )

    hard_total = hard_conflict_count + total_hard_violations
    if is_replan and hard_total > 0:
        hard_total -= 1
    F = max(0, min(100, 100 - 10 * hard_total))

    if s_values:
        S_avg = int(mean(s_values))
        S_min = min(s_values)
        Fairness = max(0, 100 - 3 * (max(s_values) - min(s_values)))
    else:
        S_avg = S_min = 0
        Fairness = 100

    final = int(0.25 * F + 0.25 * S_avg + 0.35 * S_min + 0.15 * Fairness)

    return {
        "final": final,
        "F": F,
        "S_avg": S_avg,
        "S_min": S_min,
        "Fairness": Fairness,
        "per_user": per_user,
    }
