"""Trip API contract.

3 endpoints only:
  POST /api/trip               -> create a trip & run the full graph
  GET  /api/trip/{trip_id}     -> read the current TripState (all pages share this)
  POST /api/trip/{trip_id}/event  -> inject an event (day3_rain) & re-run the graph

state is kept in-memory for the hackathon MVP. Restarting the server resets it.
"""
from __future__ import annotations

import uuid
from typing import Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.profile_store import bulk_get_profiles
from app.services.orchestrator.graph import run_full
from ..services.orchestrator.state import TripState


router = APIRouter(prefix="/api", tags=["trip"])


_TRIPS: Dict[str, TripState] = {}


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class CreateTripRequest(BaseModel):
    title: str = Field(default="国内多城深度游", description="旅行名称")
    days: int = Field(default=7, ge=1, le=30)
    budget_total: int = Field(default=30000, description="总预算 CNY")
    cities: List[str] = Field(default_factory=lambda: ["北京", "上海", "杭州"])
    member_ids: List[str] = Field(default_factory=lambda: ["A", "B", "C", "D"], description="参与成员 ID 列表")


class CreateTripResponse(BaseModel):
    trip_id: str


class EventRequest(BaseModel):
    event: str = Field(default="day3_rain", description="Event key, e.g. day3_rain")


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
        "days": payload.days,
        "budget_total": payload.budget_total,
        "cities": payload.cities,
        "member_count": len(profiles),
        "profiles": profiles,
        "events": [],
        "agent_trace": [],
    }
    final_state = run_full(initial_state)
    _TRIPS[trip_id] = final_state
    return final_state


@router.get("/trip/{trip_id}")
def get_trip(trip_id: str):
    state = _TRIPS.get(trip_id)
    if state is None:
        raise HTTPException(status_code=404, detail=f"trip {trip_id} not found")
    return state


@router.post("/trip/{trip_id}/event")
def post_event(trip_id: str, payload: EventRequest):
    state: Optional[TripState] = _TRIPS.get(trip_id)
    if state is None:
        raise HTTPException(status_code=404, detail=f"trip {trip_id} not found")

    restart_state: TripState = dict(state)  # shallow copy
    restart_state["events"] = [payload.event]
    restart_state["agent_trace"] = []
    restart_state["replan_diff"] = None

    final_state = run_full(restart_state)
    _TRIPS[trip_id] = final_state
    return final_state


@router.post("/trip/{trip_id}/replan")
def replan_trip(trip_id: str):
    state: Optional[TripState] = _TRIPS.get(trip_id)
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
    restart_state["agent_trace"] = []
    
    # 3. Run full graph
    final_state = run_full(restart_state)
    
    # 4. If replan_diff was generated, ensure old_score is set
    if final_state.get("replan_diff"):
        final_state["replan_diff"]["old_score"] = old_score
    
    _TRIPS[trip_id] = final_state
    return final_state
