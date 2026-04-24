"""Profile Agent node.

Purpose: given the trip basics, produce 4 structured member profiles.
In the MVP we don't actually receive free-text user descriptions yet --
the prompt is already built but `call_llm` returns the mock JSON. When
USE_MOCK is flipped to false the exact same prompt will be sent to Qwen.
"""
from __future__ import annotations

from ...llm_client import call_llm
from ..prompts import SYS_PROFILE, user_prompt_profile
from ..state import TripState


def run(state: TripState) -> TripState:
    trace = state.get("agent_trace", []) or []
    trace.append("profile_agent: building prompt")

    response = call_llm(
        system=SYS_PROFILE,
        user=user_prompt_profile(state),
        mock_file="profile_llm_mock.json",
    )

    state["profiles"] = response["profiles"]
    trace.append(f"profile_agent: parsed {len(state['profiles'])} profiles")
    state["agent_trace"] = trace
    return state
