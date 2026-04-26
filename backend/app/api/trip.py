"""Trip API contract.

3 endpoints only:
  POST /api/trip               -> create a trip & run the full graph
  GET  /api/trip/{trip_id}     -> read the current TripState (all pages share this)
  POST /api/trip/{trip_id}/event  -> inject an event (day3_rain) & re-run the graph

state is kept in-memory for the hackathon MVP. Restarting the server resets it.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Dict, List, Optional, Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.profile_store import bulk_get_profiles
from app.services.orchestrator.graph import run_full
from ..services.orchestrator.state import TripState, EventItem, ProposalSnapshot
from ..services.trip_store import save_trip, load_trip, delete_trip, list_trips
from ..services.orchestrator.event_registry import get_event_types_schema, format_event_title


router = APIRouter(prefix="/api", tags=["trip"])


def compute_today_index(start_date_str: str) -> int:
    try:
        start_date = datetime.fromisoformat(start_date_str).date()
        today = datetime.now().date()
        delta = (today - start_date).days
        return max(1, delta + 1)
    except Exception:
        return 1


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class CreateTripRequest(BaseModel):
    title: str = Field(default="国内多城深度游", description="旅行名称")
    start_date: str = Field(default_factory=lambda: datetime.now().date().isoformat(), description="起始日期 YYYY-MM-DD")
    days: int = Field(default=7, ge=1, le=30)
    budget_total: int = Field(default=30000, description="总预算 CNY")
    cities: List[str] = Field(default_factory=lambda: ["北京", "上海", "杭州"])
    member_ids: List[str] = Field(default_factory=lambda: ["A", "B", "C", "D"], description="参与成员 ID 列表")


class CreateTripResponse(BaseModel):
    trip_id: str


class EventRequest(BaseModel):
    type: str = Field(..., description="Event type from event-types")
    params: Dict[str, Any] = Field(default_factory=dict, description="Event parameters")
    occurs_on_day: Optional[int] = Field(None, description="Day index 1-based. Defaults to today_index.")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/trip", response_model=None)
def create_trip(payload: CreateTripRequest):
    trip_id = uuid.uuid4().hex[:8]
    
    # Load profiles from store
    profiles = bulk_get_profiles(payload.member_ids)
    if not profiles:
        raise HTTPException(status_code=400, detail="No valid members selected")

    initial_state: TripState = {
        "trip_id": trip_id,
        "title": payload.title,
        "start_date": payload.start_date,
        "days": payload.days,
        "budget_total": payload.budget_total,
        "cities": payload.cities,
        "member_count": len(profiles),
        "profiles": profiles,
        "events": [],
        "proposal_history": [],
        "agent_trace": [],
    }
    final_state = run_full(initial_state)
    
    # Retry logic if Reject or score < 70
    max_retries = 2
    retry_count = 0
    
    def should_retry(st: TripState) -> bool:
        report = st.get("evaluation_report") or {}
        scores = st.get("scores") or {}
        score = scores.get("final") or report.get("final_group_score") or 0
        is_reject = report.get("status") == "Reject"
        
        # Skip unrecoverable hard violations
        hard_violations = report.get("hard_violations") or []
        unrecoverable = {"budget_impossible", "no_food_poi"}
        if any(v.get("type") in unrecoverable for v in hard_violations):
            return False
            
        return is_reject or score < 70

    while should_retry(final_state) and retry_count < max_retries:
        retry_count += 1
        score = (final_state.get("scores") or {}).get("final", 0)
        status = (final_state.get("evaluation_report") or {}).get("status", "?")
        
        # Ensure we have a trace list to append to
        current_trace = final_state.get("agent_trace", [])
        current_trace.append(f"[retry] 方案质量不达标 (status={status}, score={score})，启动第 {retry_count}/{max_retries} 轮重试...")
        
        # Pass the trace back to the next attempt
        initial_state["agent_trace"] = current_trace
        final_state = run_full(initial_state)

    # Set baseline and initial history
    if final_state.get("proposal"):
        final_state["baseline_proposal"] = final_state["proposal"]
        snapshot: ProposalSnapshot = {
            "revision": 0,
            "created_at": datetime.now().isoformat(),
            "proposal": final_state["proposal"],
            "triggered_by_event_ids": []
        }
        final_state["proposal_history"] = [snapshot]
    
    # Mark not_recommended when status is Reject OR final score < 70
    report = final_state.get("evaluation_report") or {}
    score = (final_state.get("scores") or {}).get("final") or report.get("final_group_score") or 0
    final_state["not_recommended"] = (report.get("status") == "Reject") or (score < 70)
        
    save_trip(trip_id, final_state)
    return final_state


@router.get("/trip/{trip_id}")
def get_trip(trip_id: str):
    state = load_trip(trip_id)
    if state is None:
        raise HTTPException(status_code=404, detail=f"trip {trip_id} not found")
    return state


@router.get("/event-types")
def get_event_types():
    return get_event_types_schema()


@router.get("/trip/{trip_id}/today")
def get_trip_today(trip_id: str):
    state = load_trip(trip_id)
    if state is None:
        raise HTTPException(status_code=404, detail=f"trip {trip_id} not found")
    
    today_index = compute_today_index(state["start_date"])
    events = state.get("events") or []
    max_event_day = max((e.get("occurs_on_day", 1) for e in events), default=0)
    frozen_until = max(today_index - 1, max_event_day - 1, 0)
    
    return {
        "today_index": today_index,
        "total_days": state["days"],
        "frozen_until": frozen_until
    }


@router.post("/trip/{trip_id}/event")
def post_event(trip_id: str, payload: EventRequest):
    state = load_trip(trip_id)
    if state is None:
        raise HTTPException(status_code=404, detail=f"trip {trip_id} not found")

    today_index = compute_today_index(state["start_date"])
    occurs_on = payload.occurs_on_day or today_index
    anchor = max(today_index, occurs_on)

    # Build event item
    event_id = uuid.uuid4().hex[:8]
    event_title = format_event_title(payload.type, payload.params)
    new_event: EventItem = {
        "id": event_id,
        "type": payload.type,
        "title": event_title,
        "params": payload.params,
        "occurs_on_day": occurs_on,
        "created_at": datetime.now().isoformat(),
        "applied_in_revision": len(state.get("proposal_history", []))
    }
    
    state.setdefault("events", []).append(new_event)
    
    # Prepare for incremental replan
    # In a real implementation, we would call a specialized incremental replan node.
    # For now, we'll simulate the "frozen + dirty" logic by passing hints to the graph.
    
    state["agent_trace"] = [f"[api] 触发事件: {event_title} (Day {occurs_on}, Anchor Day {anchor})"]
    state["replan_diff"] = None
    state["adopted_at"] = None
    
    # Add anchor_day to state so agents know what to freeze
    state["anchor_day"] = anchor
    state["new_event_ids"] = [event_id]

    final_state = run_full(state)
    
    # Update history
    if final_state.get("proposal"):
        snapshot: ProposalSnapshot = {
            "revision": len(final_state.get("proposal_history", [])),
            "created_at": datetime.now().isoformat(),
            "proposal": final_state["proposal"],
            "triggered_by_event_ids": [event_id]
        }
        final_state.setdefault("proposal_history", []).append(snapshot)

    # Mark not_recommended when status is Reject OR final score < 70
    report = final_state.get("evaluation_report") or {}
    score = (final_state.get("scores") or {}).get("final") or report.get("final_group_score") or 0
    final_state["not_recommended"] = (report.get("status") == "Reject") or (score < 70)

    save_trip(trip_id, final_state)
    return final_state


@router.post("/trip/{trip_id}/replay")
def replay_trip(trip_id: str):
    """Reset trip to baseline proposal and clear events."""
    state = load_trip(trip_id)
    if state is None:
        raise HTTPException(status_code=404, detail=f"trip {trip_id} not found")

    if not state.get("baseline_proposal"):
        raise HTTPException(status_code=400, detail="No baseline proposal found")

    state["proposal"] = state["baseline_proposal"]
    state["events"] = []
    state["proposal_history"] = state["proposal_history"][:1] # Keep only baseline
    state["replan_diff"] = None
    state["agent_trace"] = ["[api] 已重置回原始方案 (Baseline)"]
    
    save_trip(trip_id, state)
    return state


@router.post("/trip/{trip_id}/replan")
def replan_trip(trip_id: str):
    state = load_trip(trip_id)
    if state is None:
        raise HTTPException(status_code=404, detail=f"trip {trip_id} not found")

    # 1. Get latest profiles from store (in case they were edited)
    member_ids = [p["user_id"] for p in state.get("profiles", [])]
    new_profiles = bulk_get_profiles(member_ids)
    
    # 2. Prepare state for re-running the graph
    restart_state: TripState = dict(state)
    if new_profiles:
        restart_state["profiles"] = new_profiles
    
    # Store old score for comparison in replan_diff
    old_score = state.get("scores")
    restart_state["agent_trace"] = ["[api] 触发全局重新编排（画像更新）"]
    # Clear events & old replan_diff so the graph re-runs the planning path,
    # not the replanner branch (only event endpoint should trigger that).
    restart_state["events"] = []
    restart_state["replan_diff"] = None
    
    # 3. Run full graph
    final_state = run_full(restart_state)
    
    # 4. If replan_diff was generated, ensure old_score is set
    if final_state.get("replan_diff"):
        final_state["replan_diff"]["old_score"] = old_score
    
    save_trip(trip_id, final_state)
    return final_state


from app.services.orchestrator.agents.evaluator_agent import run as run_evaluator

@router.post("/trip/{trip_id}/re-evaluate")
def re_evaluate_trip(trip_id: str):
    """Re-run the evaluator node without re-generating the proposal.
    Useful when profiles are edited and user wants to see new scores.
    """
    state = load_trip(trip_id)
    if state is None:
        raise HTTPException(status_code=404, detail=f"trip {trip_id} not found")

    # 1. Get latest profiles from store
    member_ids = [p["user_id"] for p in state.get("profiles", [])]
    new_profiles = bulk_get_profiles(member_ids)
    
    # 2. Update state with new profiles but keep the same proposal
    state["profiles"] = new_profiles
    
    # 3. Run only the evaluator node
    final_state = run_evaluator(state)
    save_trip(trip_id, final_state)
    return final_state
