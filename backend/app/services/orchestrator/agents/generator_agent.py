"""Itinerary Generator Agent node.

Given the profiles + conflicts + budget + city candidates, produce 1
fairness-prioritised proposal covering `days` days.
"""
from __future__ import annotations

from ...llm_client import call_llm
from ..prompts import SYS_GENERATOR, user_prompt_generator
from ..state import TripState


def run(state: TripState) -> TripState:
    trace = state.get("agent_trace", []) or []
    trace.append("generator_agent: building prompt")

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
