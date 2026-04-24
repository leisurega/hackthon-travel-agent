"""POI (Point of Interest) service with pluggable backends.

Two backends are shipped:

- AmapPOIBackend: live calls to the 高德 Web API (free tier, China coverage).
- MockPOIBackend : reads a pre-seeded JSON file. Used when AMAP_KEY is missing
  or the Amap call fails -- never breaks the Agent pipeline.

Selection:
    POI_BACKEND=amap | mock  (env var)
    If POI_BACKEND=amap but AMAP_KEY is missing or the call fails, we fall
    back to MockPOIBackend and log the event on `trace`.

Public helpers:
    get_backend()                               -> POIBackend
    build_candidate_pool(cities, trip_goals)    -> {city: [POI,...]}
"""
from __future__ import annotations

import json
import os
import sys
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Set, TypedDict

try:
    import requests
except ImportError:  # requests is optional; Amap backend simply unavailable
    requests = None  # type: ignore


_BACKEND_ROOT = Path(__file__).resolve().parent.parent
POI_POOL_FILE = _BACKEND_ROOT / "data" / "poi_pool.json"


# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------


class POI(TypedDict, total=False):
    poi_id: str
    name: str
    city: str
    category: str              # 景点 / 美食 / 博物馆 / 购物 / 公园 / 文化
    tags: List[str]            # reverse-mapped synonyms used by scoring
    lng: float
    lat: float
    avg_cost: int              # CNY per person, 0 if unknown
    rating: float              # 0-5, 0 if unknown
    address: str
    opening_hours: str


# ---------------------------------------------------------------------------
# trip_goal -> Amap typecode + tag synonyms
# ---------------------------------------------------------------------------

# Amap `types` codes, see https://lbs.amap.com/api/webservice/download
CATEGORY_SPEC: Dict[str, Dict[str, Any]] = {
    "景点": {"typecode": "110000", "tags": ["拍照", "地标", "摄影"]},
    "博物馆": {"typecode": "140100", "tags": ["博物馆", "深度文化", "艺术"]},
    "美食": {"typecode": "050000", "tags": ["美食", "餐厅"]},
    "购物": {"typecode": "060000", "tags": ["购物"]},
    "公园": {"typecode": "110105", "tags": ["放松", "山水", "休闲"]},
    "文化": {"typecode": "110200", "tags": ["深度文化", "历史"]},
}

GOAL_TO_CATEGORIES: Dict[str, List[str]] = {
    "放松": ["公园", "景点"],
    "美食": ["美食"],
    "摄影": ["景点", "公园"],
    "博物馆": ["博物馆"],
    "购物": ["购物"],
    "深度文化": ["博物馆", "文化"],
}


# ---------------------------------------------------------------------------
# Backend ABCs
# ---------------------------------------------------------------------------


class POIBackend(ABC):
    name: str = "base"

    @abstractmethod
    def search(self, city: str, category: str, top_k: int = 10) -> List[POI]: ...


class MockPOIBackend(POIBackend):
    name = "mock"

    def __init__(self, path: Path = POI_POOL_FILE):
        if not path.exists():
            self._pool: Dict[str, List[POI]] = {}
        else:
            raw = json.loads(path.read_text(encoding="utf-8"))
            self._pool = raw if isinstance(raw, dict) else {}

    def search(self, city: str, category: str, top_k: int = 10) -> List[POI]:
        city_pool = self._pool.get(city, [])
        matched = [p for p in city_pool if p.get("category") == category]
        return matched[:top_k]


class AmapPOIBackend(POIBackend):
    name = "amap"

    ENDPOINT = "https://restapi.amap.com/v3/place/text"

    def __init__(self, api_key: str):
        if requests is None:
            raise RuntimeError("`requests` package not installed; cannot use AmapPOIBackend")
        if not api_key or api_key.startswith("your_"):
            raise RuntimeError("AMAP_KEY not configured")
        self.api_key = api_key

    def search(self, city: str, category: str, top_k: int = 10) -> List[POI]:
        spec = CATEGORY_SPEC.get(category)
        if not spec:
            return []
        params = {
            "key": self.api_key,
            "city": city,
            "types": spec["typecode"],
            "offset": min(top_k, 25),
            "page": 1,
            "citylimit": "true",
            "extensions": "base",
        }
        resp = requests.get(self.ENDPOINT, params=params, timeout=8)
        resp.raise_for_status()
        payload = resp.json()
        if str(payload.get("status")) != "1":
            raise RuntimeError(f"amap error: {payload.get('info')}")
        out: List[POI] = []
        for item in payload.get("pois", [])[:top_k]:
            loc = (item.get("location") or "0,0").split(",")
            try:
                lng = float(loc[0]); lat = float(loc[1])
            except (ValueError, IndexError):
                lng = lat = 0.0
            biz_ext = item.get("biz_ext") or {}
            try:
                cost = int(float(biz_ext.get("cost") or 0))
            except (TypeError, ValueError):
                cost = 0
            try:
                rating = float(biz_ext.get("rating") or 0)
            except (TypeError, ValueError):
                rating = 0.0
            out.append(POI(
                poi_id=str(item.get("id") or item.get("name")),
                name=str(item.get("name") or ""),
                city=city,
                category=category,
                tags=list(spec["tags"]),
                lng=lng,
                lat=lat,
                avg_cost=cost,
                rating=rating,
                address=str(item.get("address") or ""),
                opening_hours="",
            ))
        return out


# ---------------------------------------------------------------------------
# Backend factory (+ automatic fallback)
# ---------------------------------------------------------------------------


def get_backend() -> POIBackend:
    choice = (os.getenv("POI_BACKEND") or "mock").lower()
    if choice == "amap":
        try:
            return AmapPOIBackend(os.getenv("AMAP_KEY") or "")
        except Exception as exc:
            print(f"[poi_service] amap backend unavailable ({exc}); falling back to mock",
                  file=sys.stderr)
    return MockPOIBackend()


# ---------------------------------------------------------------------------
# Top-level helper used by generator_agent
# ---------------------------------------------------------------------------


def _goals_to_categories(trip_goals: Sequence[str]) -> List[str]:
    cats: List[str] = []
    seen: Set[str] = set()
    for g in trip_goals:
        for c in GOAL_TO_CATEGORIES.get(g, []):
            if c not in seen:
                seen.add(c)
                cats.append(c)
    # Always include 美食 and 景点 as safety nets
    for base in ("美食", "景点"):
        if base not in seen:
            cats.append(base); seen.add(base)
    return cats


def build_candidate_pool(
    cities: Sequence[str],
    trip_goals: Sequence[str],
    top_k_per_category: int = 8,
    backend: Optional[POIBackend] = None,
) -> Dict[str, List[POI]]:
    """For each city, fetch top-K POIs across all categories implied by the
    combined trip_goals of the group. Returns {city: [POI, ...]}.

    Silent-fallback behaviour: if a single (city, category) call throws, we
    degrade to the MockPOIBackend for that category and continue. The live
    backend is reused across categories, so one cold call covers the trip.
    """
    b = backend or get_backend()
    fallback = MockPOIBackend()
    categories = _goals_to_categories(trip_goals)

    result: Dict[str, List[POI]] = {}
    for city in cities:
        bucket: List[POI] = []
        seen_ids: Set[str] = set()
        for cat in categories:
            try:
                items = b.search(city, cat, top_k=top_k_per_category)
            except Exception as exc:
                print(f"[poi_service] {b.name} search failed for {city}/{cat}: {exc}",
                      file=sys.stderr)
                items = fallback.search(city, cat, top_k=top_k_per_category)
            for it in items:
                pid = it.get("poi_id") or it.get("name")
                if pid and pid not in seen_ids:
                    seen_ids.add(pid)
                    bucket.append(it)
        result[city] = bucket
    return result
