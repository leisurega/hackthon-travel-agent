import json
import os
import shutil
from typing import List, Dict, Optional
from app.services.orchestrator.state import UserProfile

# In-memory store for user profiles
_PROFILES: Dict[str, UserProfile] = {}

PERSISTENCE_FILE = os.path.join(os.path.dirname(__file__), "..", "data", "profiles_persistence.json")
SCHEMA_VERSION = 2

def _migrate_old_profile(old: Dict) -> UserProfile:
    """Migrate a v1 profile to v2 schema."""
    # 1. Map hard constraints
    old_hard = old.get("hard_constraints", {})
    new_hard = {
        "budget_max": old_hard.get("budget_cap", 5000),
        "dietary": old_hard.get("diet", []),
        "walk_km_max": old_hard.get("daily_walk_km_max", 8.0),
        "latest_rest_time": old_hard.get("latest_rest_time", "23:00")
    }
    
    # 2. Map strong preferences (0-100 -> 0.0-1.0)
    old_strong = old.get("strong_preferences", {})
    new_strong = {k: v / 100.0 for k, v in old_strong.items()}
    
    # 3. Map anti preferences (list -> dict with 1.0 weight)
    old_anti = old.get("anti_preferences", [])
    new_anti = {item: 1.0 for item in old_anti}
    
    # 4. Map negotiable range (list -> dict)
    old_neg = old.get("negotiable_range", [])
    new_neg = {f"item_{i}": item for i, item in enumerate(old_neg)}

    goals = old.get("trip_goal") or []
    if old.get("core_story"):
        core_story = old["core_story"]
    elif goals:
        core_story = "旅行倾向：" + "、".join(str(g) for g in goals)
    else:
        core_story = "旅行偏好待补充"

    # 5. Build new profile
    new_profile: UserProfile = {
        "user_id": old.get("user_id"),
        "display_name": old.get("display_name"),
        "role": old.get("role", "成员"),
        "role_tag": old.get("key_tags", [""])[0] if old.get("key_tags") else "普通成员",
        "protection_level": "high" if new_hard["walk_km_max"] <= 5.0 else "medium",
        "core_story": core_story,
        "hard_constraints": new_hard,
        "strong_preferences": new_strong,
        "anti_preferences": new_anti,
        "negotiable_range": new_neg,
        "scoring_weights": {"T": 0.15, "B": 0.15, "P": 0.20, "I": 0.25, "F": 0.15, "S": 0.10},
        "compensation_preference": [],
    }
    return new_profile

def _save_to_disk():
    """Save the current in-memory profiles to the persistence file."""
    try:
        payload = {
            "_schema_version": SCHEMA_VERSION,
            "profiles": list(_PROFILES.values())
        }
        tmp_file = PERSISTENCE_FILE + ".tmp"
        with open(tmp_file, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp_file, PERSISTENCE_FILE)
        print(f"Saved {len(_PROFILES)} profiles to {PERSISTENCE_FILE} (atomic)")
    except Exception as e:
        print(f"Error saving profiles to disk: {e}")

def _load_from_seed():
    """Fallback to seed data if persistence doesn't exist."""
    global _PROFILES
    seed_file = os.path.join(os.path.dirname(__file__), "..", "data", "profiles_v2_seed.json")
    if not os.path.exists(seed_file):
        seed_file = os.path.join(os.path.dirname(__file__), "..", "data", "profile_llm_mock.json")

    if os.path.exists(seed_file):
        try:
            with open(seed_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                profiles = data.get("profiles", [])
                if data.get("_schema_version", 1) < SCHEMA_VERSION:
                    for p in profiles:
                        new_p = _migrate_old_profile(p)
                        _PROFILES[new_p["user_id"]] = new_p
                else:
                    for p in profiles:
                        _PROFILES[p["user_id"]] = p
            print(f"Seeded {len(_PROFILES)} profiles from {seed_file}")
            _save_to_disk()
        except Exception as e:
            print(f"Error seeding profiles: {e}")
    else:
        print(f"Warning: Seed file not found at {seed_file}")

def seed_profiles():
    """Seed the profile store with default profiles from mock data or persistence file."""
    global _PROFILES
    
    # 1. Try loading from persistence file first
    if os.path.exists(PERSISTENCE_FILE):
        try:
            with open(PERSISTENCE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                current_version = data.get("_schema_version", 1)
                if current_version < SCHEMA_VERSION:
                    print(f"Migrating profiles from v{current_version} to v{SCHEMA_VERSION}...")
                    shutil.copy2(PERSISTENCE_FILE, PERSISTENCE_FILE + ".bak")
                    profiles = data.get("profiles", [])
                    for p in profiles:
                        new_p = _migrate_old_profile(p)
                        _PROFILES[new_p["user_id"]] = new_p
                    _save_to_disk()
                    print(f"Migration complete. Backed up to {PERSISTENCE_FILE}.bak")
                else:
                    for p in data.get("profiles", []):
                        _PROFILES[p["user_id"]] = p
            print(f"Loaded {len(_PROFILES)} profiles from {PERSISTENCE_FILE}")
            return
        except Exception as e:
            print(f"CRITICAL: Error loading from persistence file: {e}")
            print("To prevent data loss, seed fallback is disabled when persistence file exists but is corrupted.")
            return

    # 2. Fallback to seed data only if persistence doesn't exist
    _load_from_seed()

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
        user_id = f"USER_{len(_PROFILES) + 1}"
        profile["user_id"] = user_id
    
    # Shallow merge to prevent data loss if frontend omits some fields
    existing = _PROFILES.get(user_id)
    if existing:
        merged = {**existing, **profile}
        print(f"Updated profile for {user_id} (merged)")
    else:
        merged = profile
        print(f"Created new profile for {user_id}")
        
    _PROFILES[user_id] = merged
    _save_to_disk()
    return merged

def delete_profile(user_id: str) -> bool:
    """Delete a profile from the pool."""
    if user_id in _PROFILES:
        del _PROFILES[user_id]
        print(f"Deleted profile for {user_id}")
        _save_to_disk()
        return True
    return False

def bulk_get_profiles(user_ids: List[str]) -> List[UserProfile]:
    """Get multiple profiles by their IDs."""
    return [_PROFILES[uid] for uid in user_ids if uid in _PROFILES]

# Initialize the store on module load
seed_profiles()
