"""LangGraph StateGraph wiring for the Travel Coordination Agent.

Flow:
    START -> profile -> conflict -> keyword -> generator -> evaluator -> explainer
    explainer -- no event  --> END
    explainer -- has event --> replanner -> evaluator -> END

Each LLM node is a thin wrapper over call_llm that preserves the full
prompt + schema contract even when USE_MOCK=true.
"""
from __future__ import annotations

import time
from typing import Any, Dict

from langgraph.graph import END, StateGraph

from .agents import (
    conflict_agent,
    explainer_agent,
    generator_agent,
    keyword_agent,
    evaluator_agent,
    profile_agent,
    replanner_agent,
    time_fixer_agent,
)
from .state import TripState


def _route_after_explainer(state: TripState) -> str:
    # If we have events and haven't replanned yet, go to replanner
    if state.get("events") and not state.get("replan_diff"):
        return "replanner"
    return "done"


def _route_after_evaluator(state: TripState) -> str:
    report = state.get("evaluation_report") or {}
    if report.get("status") == "Reject":
        # If there are hard violations, try time_fixer first
        hard_violations = report.get("hard_violations") or []
        if any(v.get("type") == "time_window_violation" for v in hard_violations):
            return "time_fixer"
        # For other hard violations, if we are in the middle of a replan, we might be stuck
        # but for now let's just go to explainer to show the result
    return "explainer"


def build_graph():
    g = StateGraph(TripState)
    g.add_node("profile", profile_agent.run)
    g.add_node("conflict", conflict_agent.run)
    g.add_node("keyword", keyword_agent.run)
    g.add_node("generator", generator_agent.run)
    g.add_node("evaluator", evaluator_agent.run)
    g.add_node("time_fixer", time_fixer_agent.run)
    g.add_node("explainer", explainer_agent.run)
    g.add_node("replanner", replanner_agent.run)

    g.set_entry_point("profile")
    g.add_edge("profile", "conflict")
    g.add_edge("conflict", "keyword")
    g.add_edge("keyword", "generator")
    g.add_edge("generator", "evaluator")
    
    g.add_conditional_edges(
        "evaluator",
        _route_after_evaluator,
        {"time_fixer": "time_fixer", "explainer": "explainer"}
    )
    
    g.add_edge("time_fixer", "explainer")
    
    g.add_conditional_edges(
        "explainer",
        _route_after_explainer,
        {"replanner": "replanner", "done": END},
    )
    g.add_edge("replanner", "evaluator")

    return g.compile()


_graph = None


def get_graph():
    global _graph
    if _graph is None:
        _graph = build_graph()
    return _graph


def run_full(initial_state: Dict[str, Any]) -> Dict[str, Any]:
    """Convenience wrapper: invoke the compiled graph and return the
    resulting state dict."""
    graph = get_graph()
    return graph.invoke(initial_state)
