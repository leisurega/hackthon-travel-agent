"""Conflict Agent node.

Consumes the 4 profiles and emits a conflict list + heatmap + summary.
"""
from __future__ import annotations

import time

from ...llm_client import call_llm
from ..prompts import SYS_CONFLICT, user_prompt_conflict
from ..state import TripState


def run(state: TripState) -> TripState:
    trace = state.get("agent_trace", []) or []
    started = time.time()

    response = call_llm(
        system=SYS_CONFLICT,
        user=user_prompt_conflict(state.get("profiles", [])),
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
            "description": c["summary"],
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
    state["agent_trace"] = trace
    return state
