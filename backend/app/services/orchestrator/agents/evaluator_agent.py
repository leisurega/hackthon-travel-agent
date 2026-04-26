"""Evaluator Agent node.

Performs LLM-based semantic evaluation and compensation audit.
Quantification and aggregation are handled in evaluation.py.
"""
from __future__ import annotations

import time
from typing import Any, Dict

from ...llm_client import call_llm
from ..prompts import SYS_EVALUATOR_V2, user_prompt_evaluator
from ..state import TripState
from ..evaluation import run_evaluation_pipeline


def run(state: TripState) -> TripState:
    trace = state.get("agent_trace", []) or []
    started = time.time()

    # 1. Call LLM for semantic evaluation (Layer B)
    llm_scores = call_llm(
        system=SYS_EVALUATOR_V2,
        user=user_prompt_evaluator(state),
        mock_file="evaluator_llm_mock.json",
    )

    # 2. Run full evaluation pipeline (Layer A + Layer C)
    # This includes Python-based quantification and aggregation
    evaluation_report = run_evaluation_pipeline(state, llm_scores)
    
    state["evaluation_report"] = evaluation_report
    
    # Legacy compatibility for scores field
    state["scores"] = {
        "final": evaluation_report["final_group_score"],
        "F": evaluation_report["metrics"]["execution_efficiency"], # Placeholder
        "S_avg": evaluation_report["metrics"]["s_avg"],
        "S_min": evaluation_report["metrics"]["s_min"],
        "Fairness": evaluation_report["metrics"]["fairness"],
        "per_user": evaluation_report["per_user"]
    }

    elapsed = int((time.time() - started) * 1000)
    trace.append(
        f"[evaluator] 评分: {evaluation_report['final_group_score']} "
        f"(S_avg: {evaluation_report['metrics']['s_avg']}, Fairness: {evaluation_report['metrics']['fairness']}) "
        f"({elapsed}ms)"
    )
    state["agent_trace"] = trace
    return state
