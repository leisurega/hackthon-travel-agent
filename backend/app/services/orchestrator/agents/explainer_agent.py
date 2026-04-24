"""Explainer Agent node.

Unlike the other agents, this one calls the real Qwen by default (even when
USE_MOCK=true) so that the demo has one live LLM moment. If the network
flakes at demo time, it transparently falls back to `explanation_cache.json`.
"""
from __future__ import annotations

import os

from ...llm_client import call_llm
from ..prompts import SYS_EXPLAINER, user_prompt_explainer
from ..state import TripState


def _force_real() -> bool:
    """Allow explainer to be switched back to pure mock via env var
    (FORCE_REAL_EXPLAINER=false) for offline demos."""
    return os.getenv("FORCE_REAL_EXPLAINER", "true").lower() == "true"


def run(state: TripState) -> TripState:
    trace = state.get("agent_trace", []) or []
    trace.append("explainer_agent: building prompt (live Qwen preferred)")

    response = call_llm(
        system=SYS_EXPLAINER,
        user=user_prompt_explainer(state),
        mock_file="explanation_cache.json",
        fallback_mock_file="explanation_cache.json",
        force_real=_force_real(),
    )

    state["explanations"] = {
        "recommendation_reasons": response["recommendation_reasons"],
        "per_user_impact": response["per_user_impact"],
    }
    trace.append(
        f"explainer_agent: {len(response['per_user_impact'])} user impacts generated"
    )
    state["agent_trace"] = trace
    return state
