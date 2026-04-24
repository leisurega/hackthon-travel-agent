import json
import os
from typing import List, Dict, Optional
from app.services.orchestrator.state import UserProfile

# In-memory store for user profiles
_PROFILES: Dict[str, UserProfile] = {}

def seed_profiles():
    """Seed the profile store with default profiles from mock data."""
    global _PROFILES
    mock_file = os.path.join(os.path.dirname(__file__), "..", "data", "profile_llm_mock.json")
    try:
        if os.path.exists(mock_file):
            with open(mock_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                for p in data.get("profiles", []):
                    _PROFILES[p["user_id"]] = p
        else:
            print(f"Warning: Mock file not found at {mock_file}")
    except Exception as e:
        print(f"Error seeding profiles: {e}")

def list_profiles() -> List[UserProfile]:
    """List all available profiles in the pool."""
    return list(_PROFILES.values())

def get_profile(user_id: str) -> Optional[UserProfile]:
    """Get a single profile by ID."""
    return _PROFILES.get(user_id)

def upsert_profile(profile: UserProfile) -> UserProfile:
    """Add or update a profile in the pool."""
    user_id = profile.get("user_id")
    if not user_id:
        # Simple ID generation if missing
        user_id = f"USER_{len(_PROFILES) + 1}"
        profile["user_id"] = user_id
    _PROFILES[user_id] = profile
    return profile

def delete_profile(user_id: str) -> bool:
    """Delete a profile from the pool."""
    if user_id in _PROFILES:
        del _PROFILES[user_id]
        return True
    return False

def bulk_get_profiles(user_ids: List[str]) -> List[UserProfile]:
    """Get multiple profiles by their IDs."""
    return [_PROFILES[uid] for uid in user_ids if uid in _PROFILES]

# Initialize the store on module load
seed_profiles()
