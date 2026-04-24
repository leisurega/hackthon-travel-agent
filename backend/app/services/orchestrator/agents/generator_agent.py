"""Itinerary Generator Agent node.

Pre-step: fetch a real POI candidate pool (via `poi_service`) based on the
group's combined trip_goals and the target cities. The pool is stored on the
state and also inlined into the LLM user prompt so the model selects from
real venues rather than hallucinating.

Main step: invoke the LLM (or the mock JSON when USE_MOCK=true) with the
augmented prompt. The response shape is unchanged.
"""
from __future__ import annotations

from ...llm_client import call_llm
from ...poi_service import build_candidate_pool, get_backend
from ..prompts import SYS_GENERATOR, user_prompt_generator
from ..state import TripState


def _collect_trip_goals(state: TripState):
    goals = []
    for p in state.get("profiles") or []:
        for g in p.get("trip_goal") or []:
            if g not in goals:
                goals.append(g)
    return goals


def run(state: TripState) -> TripState:
    trace = state.get("agent_trace", []) or []
    trace.append("generator_agent: building POI candidate pool")

    cities = state.get("cities") or ["北京", "上海", "杭州"]
    goals = _collect_trip_goals(state)

    backend = get_backend()
    try:
        poi_pool = build_candidate_pool(cities, goals, backend=backend)
        total = sum(len(v) for v in poi_pool.values())
        trace.append(
            f"generator_agent: poi_service({backend.name}) fetched {total} POIs "
            f"for {cities}"
        )
    except Exception as exc:
        poi_pool = {}
        trace.append(f"generator_agent: poi_service failed ({exc}); running with empty pool")

    state["poi_pool"] = poi_pool

    trace.append("generator_agent: calling LLM generator")
    response = call_llm(
        system=SYS_GENERATOR,
        user=user_prompt_generator(state),
        mock_file="proposal_llm_mock.json",
    )

    state["proposal"] = response["proposal"]
    trace.append(
        f"generator_agent: proposal with {len(state['proposal']['per_day'])} days, "
        f"cities={state['proposal']['cities']}"
    )
    state["agent_trace"] = trace
    return state
