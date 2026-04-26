"""Replanner Agent node.

Triggered only when state["events"] is non-empty. Produces a
minimum-disturbance replacement for the affected days and replaces
state["proposal"] so that `scorer_node` can re-score it.
"""
from __future__ import annotations

import time

from ...llm_client import call_llm
from ..prompts import SYS_REPLANNER, user_prompt_replanner
from ..state import TripState


def run(state: TripState) -> TripState:
    trace = state.get("agent_trace", []) or []
    started = time.time()

    response = call_llm(
        system=SYS_REPLANNER,
        user=user_prompt_replanner(state),
        mock_file="replan_llm_mock.json",
    )

    state["replan_diff"] = response["replan_diff"]
    state["proposal"] = response["new_proposal"]
    
    # Clean up temporary API hints
    if "anchor_day" in state: del state["anchor_day"]
    if "new_event_ids" in state: del state["new_event_ids"]

    old_score = state.get("scores")
    if state["replan_diff"] is not None and old_score is not None:
        state["replan_diff"]["old_score"] = old_score

    elapsed = int((time.time() - started) * 1000)
    
    diff = state.get("replan_diff") or {}
    event_label = (
        diff.get("event_summary")
        or diff.get("event_title")
        or diff.get("event")
        or "未知事件"
    )
    disturbance = diff.get("disturbance", "未知")
    trace.append(
        f"[replanner] 突发事件={event_label} 扰动程度={disturbance} ({elapsed}ms)"
    )
    state["agent_trace"] = trace
    return state
