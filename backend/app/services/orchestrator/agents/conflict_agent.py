"""Conflict Agent node.

Consumes the 4 profiles and emits a conflict list + heatmap + summary.
"""
from __future__ import annotations

from ...llm_client import call_llm
from ..prompts import SYS_CONFLICT, user_prompt_conflict
from ..state import TripState


def run(state: TripState) -> TripState:
    trace = state.get("agent_trace", []) or []
    trace.append("conflict_agent: building prompt")

    response = call_llm(
        system=SYS_CONFLICT,
        user=user_prompt_conflict(state.get("profiles", [])),
        mock_file="conflict_llm_mock.json",
    )

    state["conflicts"] = response["conflicts"]
    state["conflict_summary"] = response["conflict_summary"]
    state["heatmap"] = response["heatmap"]
    trace.append(
        f"conflict_agent: {len(state['conflicts'])} conflicts, "
        f"feasibility={state['conflict_summary']['feasibility']}"
    )
    state["agent_trace"] = trace
    return state
