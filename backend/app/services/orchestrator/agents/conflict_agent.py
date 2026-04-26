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
    
    # Legacy compatibility
    state["conflicts"] = [
        {
            "conflict_id": f"c_{i}",
            "type": c["dimension"],
            "title": c["summary"],
            "users": c["involved_users"],
            "severity": c["tier"],
            "description": f"{c['summary']} (证据: {c.get('evidence', '无')})",
            "suggestion": c["suggestion"],
            "is_hard": c["tier"] == "硬需求"
        }
        for i, c in enumerate(response.get("dimension_conflicts", []))
    ]
    state["conflict_summary"] = {
        "total": len(state["conflicts"]),
        "high_priority": sum(1 for c in response.get("dimension_conflicts", []) if c["tier"] == "硬需求"),
        "hard": sum(1 for c in response.get("dimension_conflicts", []) if c["tier"] == "硬需求"),
        "feasibility": 100 if response.get("feasibility_status") == "Pass" else 70
    }
    state["heatmap"] = response.get("heatmap", [])
    
    elapsed = int((time.time() - started) * 1000)
    trace.append(
        f"[conflict] 识别到 {len(state['conflicts'])} 条冲突，"
        f"可行性 {state['conflict_summary']['feasibility']}% ({elapsed}ms)"
    )
    
    common_prefs = _extract_common_strong_prefs(profiles)
    blacklist = _extract_global_blacklist(profiles)
    trace.append(
        f"[conflict] 共性偏好={common_prefs} 全员黑名单={blacklist}"
    )
    
    state["agent_trace"] = trace
    return state
