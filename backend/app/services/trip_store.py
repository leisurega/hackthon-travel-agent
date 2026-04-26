import sqlite3
import json
import os
from typing import Dict, List, Optional, Tuple
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "trips.sqlite")

def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS trips (
            id TEXT PRIMARY KEY,
            state_json TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()

def save_trip(trip_id: str, state: dict) -> None:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    state_json = json.dumps(state, ensure_ascii=False)
    updated_at = datetime.now().isoformat()
    cursor.execute("""
        INSERT INTO trips (id, state_json, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            state_json = excluded.state_json,
            updated_at = excluded.updated_at
    """, (trip_id, state_json, updated_at))
    conn.commit()
    conn.close()

def load_trip(trip_id: str) -> Optional[dict]:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT state_json FROM trips WHERE id = ?", (trip_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return json.loads(row[0])
    return None

def delete_trip(trip_id: str) -> None:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM trips WHERE id = ?", (trip_id,))
    conn.commit()
    conn.close()

def list_trips() -> List[Tuple[str, str]]:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id, updated_at FROM trips ORDER BY updated_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return rows

# Initialize on import
init_db()
