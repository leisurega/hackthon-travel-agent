from typing import List
from fastapi import APIRouter, HTTPException
from app.services.profile_store import list_profiles, get_profile, upsert_profile, delete_profile
from app.services.orchestrator.state import UserProfile

router = APIRouter(prefix="/api/profiles", tags=["profiles"])

@router.get("", response_model=List[UserProfile])
def api_list_profiles():
    return list_profiles()

@router.get("/{user_id}", response_model=UserProfile)
def api_get_profile(user_id: str):
    profile = get_profile(user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile

@router.post("", response_model=UserProfile)
def api_create_profile(profile: UserProfile):
    return upsert_profile(profile)

@router.put("/{user_id}", response_model=UserProfile)
def api_update_profile(user_id: str, profile: UserProfile):
    profile["user_id"] = user_id
    return upsert_profile(profile)

@router.delete("/{user_id}")
def api_delete_profile(user_id: str):
    if not delete_profile(user_id):
        raise HTTPException(status_code=404, detail="Profile not found")
    return {"status": "ok"}
