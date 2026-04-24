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

from ..services.orchestrator.graph import run_full
from ..services.orchestrator.state import TripState


router = APIRouter(prefix="/api", tags=["trip"])


_TRIPS: Dict[str, TripState] = {}


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class CreateTripRequest(BaseModel):
    title: str = Field(default="意大利与法国浪漫之旅", description="旅行名称")
    days: int = Field(default=7, ge=1, le=30)
    budget_total: int = Field(default=40000, description="总预算 CNY")
    cities: List[str] = Field(default_factory=lambda: ["巴黎", "佛罗伦萨", "罗马"])
    member_count: int = Field(default=4, ge=2, le=8)


class CreateTripResponse(BaseModel):
    trip_id: str


class EventRequest(BaseModel):
    event: str = Field(default="day3_rain", description="Event key, e.g. day3_rain")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/trip", response_model=CreateTripResponse)
def create_trip(payload: CreateTripRequest) -> CreateTripResponse:
    trip_id = uuid.uuid4().hex[:8]
    initial_state: TripState = {
        "trip_id": trip_id,
        "title": payload.title,
        "days": payload.days,
        "budget_total": payload.budget_total,
        "cities": payload.cities,
        "member_count": payload.member_count,
        "events": [],
        "agent_trace": [],
    }
    final_state = run_full(initial_state)
    _TRIPS[trip_id] = final_state
    return CreateTripResponse(trip_id=trip_id)


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
