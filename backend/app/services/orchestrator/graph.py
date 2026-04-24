"""LangGraph StateGraph wiring for the Travel Coordination Agent.

Flow:
    START -> profile -> conflict -> generator -> scorer -> explainer
    explainer -- no event  --> END
    explainer -- has event --> replanner -> rescore -> END

Each LLM node is a thin wrapper over call_llm that preserves the full
prompt + schema contract even when USE_MOCK=true.
"""
from __future__ import annotations

from typing import Any, Dict

from langgraph.graph import END, StateGraph

from .agents import (
    conflict_agent,
    explainer_agent,
    generator_agent,
    profile_agent,
    replanner_agent,
)
from .scoring import score
from .state import TripState


def _scorer_node(state: TripState) -> TripState:
    trace = state.get("agent_trace", []) or []
    trace.append("scorer_node: computing score")
    result = score(
        state.get("proposal", {}),
        state.get("profiles", []),
        state.get("conflicts"),
        is_replan=False,
    )
    state["scores"] = result
    trace.append(f"scorer_node: final={result['final']}")
    state["agent_trace"] = trace
    return state


def _rescorer_node(state: TripState) -> TripState:
    trace = state.get("agent_trace", []) or []
    trace.append("rescorer_node: re-computing score after replan")
    result = score(
        state.get("proposal", {}),
        state.get("profiles", []),
        state.get("conflicts"),
        is_replan=True,
    )
    state["scores"] = result
    if state.get("replan_diff") is not None:
        state["replan_diff"]["new_score"] = result
    trace.append(f"rescorer_node: new_final={result['final']}")
    state["agent_trace"] = trace
    return state


def _route_after_explainer(state: TripState) -> str:
    return "replanner" if state.get("events") else "done"


def build_graph():
    g = StateGraph(TripState)
    g.add_node("profile", profile_agent.run)
    g.add_node("conflict", conflict_agent.run)
    g.add_node("generator", generator_agent.run)
    g.add_node("scorer", _scorer_node)
    g.add_node("explainer", explainer_agent.run)
    g.add_node("replanner", replanner_agent.run)
    g.add_node("rescorer", _rescorer_node)

    g.set_entry_point("profile")
    g.add_edge("profile", "conflict")
    g.add_edge("conflict", "generator")
    g.add_edge("generator", "scorer")
    g.add_edge("scorer", "explainer")
    g.add_conditional_edges(
        "explainer",
        _route_after_explainer,
        {"replanner": "replanner", "done": END},
    )
    g.add_edge("replanner", "rescorer")
    g.add_edge("rescorer", END)

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
