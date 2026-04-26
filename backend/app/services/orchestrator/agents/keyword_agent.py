"""Keyword Agent node.

Extracts search keywords for POI service based on user profiles.
"""
from __future__ import annotations

import time
from typing import Any, Dict

from ...llm_client import call_llm
from ..prompts import SYS_KEYWORD_EXTRACTOR, user_prompt_keyword
from ..state import TripState


def run(state: TripState) -> TripState:
    trace = state.get("agent_trace", []) or []
    started = time.time()

    response = call_llm(
        system=SYS_KEYWORD_EXTRACTOR,
        user=user_prompt_keyword(
            state.get("profiles", []),
            state.get("days", 7),
            state.get("cities", ["杭州"])
        ),
        mock_file="keyword_llm_mock.json",
    )

    state["keywords"] = response
    
    elapsed = int((time.time() - started) * 1000)
    trace.append(
        f"[keyword] 提取关键字: {response.get('group_keywords', '')} ({elapsed}ms)"
    )
    state["agent_trace"] = trace
    return state
