"""Conflict Agent node.

Consumes the 4 profiles and emits a conflict list + heatmap + summary.
"""
from __future__ import annotations

import time

from ...llm_client import call_llm
from ..prompts import SYS_CONFLICT, user_prompt_conflict
from ..state import TripState


def _extract_common_strong_prefs(profiles: List[UserProfile]) -> List[str]:
    """Simple aggregation of common strong preferences keys (intersection)."""
    if not profiles: return []
    common = None
    for p in profiles:
        strong = p.get("strong_preferences") or {}
        keys = {k for k, v in strong.items() if v >= 0.7}
        if common is None:
            common = keys
        else:
            common &= keys
    return list(common) if common else []


def _extract_global_blacklist(profiles: List[UserProfile]) -> List[str]:
    """Aggregation of all anti-preferences >= 0.9 and dietary restrictions."""
    blacklist = set()
    for p in profiles:
        anti = p.get("anti_preferences") or {}
        for k, v in anti.items():
            if v >= 0.9:
                blacklist.add(k)
        diet = p.get("hard_constraints", {}).get("dietary") or []
        for d in diet:
            blacklist.add(d)
    return list(blacklist)


def run(state: TripState) -> TripState:
    trace = state.get("agent_trace", []) or []
    started = time.time()

    profiles = state.get("profiles", [])
    response = call_llm(
        system=SYS_CONFLICT,
        user=user_prompt_conflict(profiles),
        mock_file="conflict_llm_mock.json",
    )

    # V2 schema support
    state["conflicts_v2"] = response
    
_TIER_MAP = {"硬需求": 3, "强软": 2, "弱软": 1}
_SEVERITY_MAP = {3: "高", 2: "中", 1: "低", 0: "低"}
_DIM_ROW = {"T": 0, "B": 1, "P": 2, "I": 3, "F": 4, "S": 5}
_DIM_KEYWORDS = {
    "T": ["T", "时间", "可用", "time"],
    "B": ["B", "预算", "钱", "费用", "budget"],
    "P": ["P", "节奏", "强度", "pace"],
    "I": ["I", "兴趣", "偏好", "interest"],
    "F": ["F", "饮食", "口味", "food", "diet"],
    "S": ["S", "社交", "关系", "social"],
}

def _norm_cell(v):
    try:
        x = float(v)
    except (TypeError, ValueError):
        return 0
    if x <= 3:
        return max(0, min(3, int(round(x))))
    return max(0, min(3, int((int(x) + 32) // 33)))

def _resolve_dim_key(c: dict) -> str | None:
    raw = (c.get("dim_key") or c.get("dimension") or "").strip()
    if not raw: return None
    upper = raw.upper()
    if upper in _DIM_ROW: return upper
    for k, kws in _DIM_KEYWORDS.items():
        if any(kw in raw for kw in kws):
            return k
    return None

def _resolve_users(uids: list, profile_ids: list, name_to_id: dict) -> list:
    out = []
    for u in uids or []:
        if u in profile_ids:
            out.append(u)
        elif u in name_to_id:
            out.append(name_to_id[u])
    return out

def rebuild_heatmap(profiles: list, response_v2: dict) -> tuple[list[list[int]], int, int]:
    """Rebuild heatmap from dimension_conflicts only (pure mapping)."""
    profile_ids = [p.get("user_id") for p in profiles]
    name_to_id = {p.get("display_name"): p.get("user_id") for p in profiles}
    num_users = len(profile_ids)
    new_heatmap = [[0] * num_users for _ in range(6)]

    # Fill from dimension_conflicts
    hit_count = 0
    conflicts = response_v2.get("dimension_conflicts", [])
    for c in conflicts:
        dim = _resolve_dim_key(c)
        row_idx = _DIM_ROW.get(dim)
        involved = _resolve_users(c.get("involved_users", []), profile_ids, name_to_id)
        
        if row_idx is not None and involved:
            hit_count += 1
            val = _TIER_MAP.get(c.get("tier"), 0)
            for uid in involved:
                col_idx = profile_ids.index(uid)
                new_heatmap[row_idx][col_idx] = max(new_heatmap[row_idx][col_idx], val)
    
    return new_heatmap, hit_count, len(conflicts)

def run(state: TripState) -> TripState:
    trace = state.get("agent_trace", []) or []
    started = time.time()

    profiles = state.get("profiles", [])
    response = call_llm(
        system=SYS_CONFLICT,
        user=user_prompt_conflict(profiles),
        mock_file="conflict_llm_mock.json",
    )

    # V2 schema support
    state["conflicts_v2"] = response
    
    # Legacy compatibility
    state["conflicts"] = [
        {
            "conflict_id": f"c_{i}",
            "type": c["dimension"],
            "title": c["summary"],
            "users": c["involved_users"],
            "severity": _SEVERITY_MAP.get(_TIER_MAP.get(c["tier"], 0), "低"),
            "description": f"{c['summary']} (证据: {c.get('evidence', '无')})",
            "suggestion": c["suggestion"],
            "is_hard": c["tier"] == "硬需求",
            "tier": c["tier"]
        }
        for i, c in enumerate(response.get("dimension_conflicts", []))
    ]
    state["conflict_summary"] = {
        "total": len(state["conflicts"]),
        "high_priority": sum(1 for c in response.get("dimension_conflicts", []) if c["tier"] == "硬需求"),
        "hard": sum(1 for c in response.get("dimension_conflicts", []) if c["tier"] == "硬需求"),
        "feasibility": 100 if response.get("feasibility_status") == "Pass" else 70
    }

    # Rebuild heatmap (pure mapping from conflicts)
    new_hm, hit_count, total_count = rebuild_heatmap(profiles, response)
    state["heatmap"] = new_hm
    
    elapsed = int((time.time() - started) * 1000)
    trace.append(
        f"[conflict] 识别到 {len(state['conflicts'])} 条冲突，"
        f"heatmap 反推命中 {hit_count}/{total_count} 条，"
        f"可行性 {state['conflict_summary']['feasibility']}% ({elapsed}ms)"
    )

    
    common_prefs = _extract_common_strong_prefs(profiles)
    blacklist = _extract_global_blacklist(profiles)
    trace.append(
        f"[conflict] 共性偏好={common_prefs} 全员黑名单={blacklist}"
    )
    
    state["agent_trace"] = trace
    return state
