"""FastAPI entry.

Run:
    cd backend
    uvicorn app.main:app --reload --port 8000
"""
from __future__ import annotations

import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.trip import router as trip_router


load_dotenv(override=True)


app = FastAPI(title="Travel Coordination Agent", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(trip_router)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "use_mock": os.getenv("USE_MOCK", "true"),
    }
