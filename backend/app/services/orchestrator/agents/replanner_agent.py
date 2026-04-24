"""Replanner Agent node.

Triggered only when state["events"] is non-empty. Produces a
minimum-disturbance replacement for the affected days and replaces
state["proposal"] so that `scorer_node` can re-score it.
"""
from __future__ import annotations

from ...llm_client import call_llm
from ..prompts import SYS_REPLANNER, user_prompt_replanner
from ..state import TripState


def run(state: TripState) -> TripState:
    trace = state.get("agent_trace", []) or []
    trace.append("replanner_agent: building prompt")

    response = call_llm(
        system=SYS_REPLANNER,
        user=user_prompt_replanner(state),
        mock_file="replan_llm_mock.json",
    )

    state["replan_diff"] = response["replan_diff"]
    state["proposal"] = response["new_proposal"]

    old_score = state.get("scores")
    if state["replan_diff"] is not None and old_score is not None:
        state["replan_diff"]["old_score"] = old_score

    trace.append(
        f"replanner_agent: event={state['replan_diff']['event']} "
        f"disturbance={state['replan_diff']['disturbance']}"
    )
    state["agent_trace"] = trace
    return state
