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
    trace.append(f"[keyword] group_keywords={response.get('group_keywords','')} ({elapsed}ms)")
    trace.append(f"[keyword] food_keywords={response.get('food_keywords',[])}")
    trace.append(f"[keyword] per_user_keywords={response.get('per_user_keywords',{})}")
    trace.append(f"[keyword] 推理依据: {response.get('reasoning', '无')}")
    
    state["agent_trace"] = trace
    return state
