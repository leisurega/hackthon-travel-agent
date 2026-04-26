"""Profile Agent node.

Purpose: given the trip basics, produce 4 structured member profiles.
In the MVP we don't actually receive free-text user descriptions yet --
the prompt is already built but `call_llm` returns the mock JSON. When
USE_MOCK is flipped to false the exact same prompt will be sent to Qwen.
"""
from __future__ import annotations

import time

from ...llm_client import call_llm
from ..prompts import SYS_PROFILE, user_prompt_profile
from ..state import TripState


def run(state: TripState) -> TripState:
    trace = state.get("agent_trace", []) or []
    started = time.time()

    # If profiles are already provided (e.g. from profile_store in create_trip), skip generation
    if state.get("profiles"):
        elapsed = int((time.time() - started) * 1000)
        trace.append(
            f"[profile] 复用 {len(state['profiles'])} 个已存画像（跳过 LLM） ({elapsed}ms)"
        )
        state["agent_trace"] = trace
        return state

    response = call_llm(
        system=SYS_PROFILE,
        user=user_prompt_profile(state),
        mock_file="profile_llm_mock.json",
    )

    state["profiles"] = response["profiles"]
    elapsed = int((time.time() - started) * 1000)
    trace.append(
        f"[profile] 通过 LLM 生成 {len(state['profiles'])} 份画像 "
        f"({elapsed}ms)"
    )
    state["agent_trace"] = trace
    return state
