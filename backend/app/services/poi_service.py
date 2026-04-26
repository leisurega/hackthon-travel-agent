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
import time
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Sequence, Set, Tuple, TypedDict

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


from .poi_metadata_enricher import enrich_poi

class POIBackend(ABC):
    name: str = "base"

    @abstractmethod
    def search(self, city: str, category: str, keywords: Optional[str] = None, top_k: int = 10) -> List[POI]: ...

    @abstractmethod
    def detail_lookup(self, poi_ids: List[str]) -> Dict[str, dict]: ...


class MockPOIBackend(POIBackend):
    name = "mock"

    def __init__(self, path: Path = POI_POOL_FILE):
        if not path.exists():
            self._pool: Dict[str, List[POI]] = {}
        else:
            raw = json.loads(path.read_text(encoding="utf-8"))
            self._pool = raw if isinstance(raw, dict) else {}

    def search(self, city: str, category: str, keywords: Optional[str] = None, top_k: int = 10) -> List[POI]:
        city_pool = self._pool.get(city, [])
        # Ensure all POIs in pool are enriched
        enriched_pool = [enrich_poi(dict(p)) for p in city_pool]
        
        matched = [p for p in enriched_pool if p.get("category") == category]
        
        # Relaxed keyword filtering: name, tags, or category
        if keywords:
            kw_list = [k.strip() for k in keywords.split("|") if k.strip()]
            if kw_list:
                filtered = []
                for p in matched:
                    search_text = (p.get("name") or "") + (p.get("category") or "") + "".join(p.get("tags") or [])
                    if any(kw in search_text for kw in kw_list):
                        filtered.append(p)
                
                # Fallback to category-only if keyword search yields nothing
                if filtered:
                    matched = filtered
        
        return matched[:top_k]

    def detail_lookup(self, poi_ids: List[str]) -> Dict[str, dict]:
        return {}


class AmapPOIBackend(POIBackend):
    name = "amap"

    ENDPOINT = "https://restapi.amap.com/v3/place/text"
    DETAIL_ENDPOINT = "https://restapi.amap.com/v3/place/detail"

    def __init__(self, api_key: str):
        if requests is None:
            raise RuntimeError("`requests` package not installed; cannot use AmapPOIBackend")
        if not api_key or api_key.startswith("your_"):
            raise RuntimeError("AMAP_KEY not configured")
        self.api_key = api_key

    def search(self, city: str, category: str, keywords: Optional[str] = None, top_k: int = 10) -> List[POI]:
        spec = CATEGORY_SPEC.get(category)
        if not spec:
            return []
        
        # Use keywords if provided, otherwise use category name
        search_keywords = keywords if keywords else category
        
        params = {
            "key": self.api_key,
            "city": city,
            "keywords": search_keywords,
            "types": spec["typecode"],
            "offset": min(top_k, 25),
            "page": 1,
            "citylimit": "true",
            "extensions": "all",
        }
        
        last_exc = None
        for attempt in range(3):
            try:
                resp = requests.get(self.ENDPOINT, params=params, timeout=8)
                resp.raise_for_status()
                payload = resp.json()
                status = str(payload.get("status"))
                if status == "1":
                    return [self._parse_poi(it, city, category, spec["tags"])
                            for it in payload.get("pois", [])[:top_k]]
                
                info = payload.get("info", "")
                if info == "USERKEY_PLAT_NOMATCH":
                    raise RuntimeError(
                        f"amap error: USERKEY_PLAT_NOMATCH (10009). "
                        f"当前 AMAP_KEY 平台类型不匹配。请前往 https://console.amap.com/dev/key/app "
                        f"申请一个新的「Web 服务」类型的 Key。"
                    )
                if info == "CUQPS_HAS_EXCEEDED_THE_LIMIT":
                    # 限流，退避重试
                    time.sleep(0.5 * (attempt + 1))
                    last_exc = RuntimeError(f"amap throttled: {info}")
                    continue
                
                raise RuntimeError(f"amap error: {info}")
            except Exception as exc:
                last_exc = exc
                time.sleep(0.3)
        
        raise last_exc or RuntimeError("amap search failed after retries")

    def detail_lookup(self, poi_ids: List[str]) -> Dict[str, dict]:
        """Fetch full details for multiple POIs by their IDs."""
        if not poi_ids:
            return {}
        # Amap detail API only supports one ID per request in standard web service,
        # or semicolon separated IDs in some versions. We'll do it one by one or 
        # check if batch is supported. Standard v3/place/detail supports multiple IDs.
        params = {
            "key": self.api_key,
            "id": ";".join(poi_ids[:20]), # Limit to 20 IDs per batch
            "extensions": "all",
        }
        try:
            resp = requests.get(self.DETAIL_ENDPOINT, params=params, timeout=8)
            resp.raise_for_status()
            payload = resp.json()
            if str(payload.get("status")) != "1":
                return {}
            
            details = {}
            for item in payload.get("pois", []):
                pid = item.get("id")
                if pid:
                    details[pid] = item
            return details
        except Exception as exc:
            print(f"[poi_service] amap detail_lookup failed: {exc}", file=sys.stderr)
            return {}

    def _parse_poi(self, item: dict, city: str, category: str, tags: List[str]) -> POI:
        loc = (item.get("location") or "0,0").split(",")
        try:
            lng = float(loc[0]); lat = float(loc[1])
        except (ValueError, IndexError):
            lng = lat = 0.0
        
        # 高德可能返回 "" 而不是 {} 或 None，必须类型守卫
        biz_ext = item.get("biz_ext")
        if not isinstance(biz_ext, dict):
            biz_ext = {}
        try:
            cost = int(float(biz_ext.get("cost") or 0))
        except (TypeError, ValueError):
            cost = 0
        try:
            rating = float(biz_ext.get("rating") or 0)
        except (TypeError, ValueError):
            rating = 0.0
        
        # shopinfo 同理
        shopinfo = item.get("shopinfo")
        if not isinstance(shopinfo, dict):
            shopinfo = {}
        opening_hours = str(shopinfo.get("opentime") or "")
        
        poi = POI(
            poi_id=str(item.get("id") or item.get("name")),
            name=str(item.get("name") or ""),
            city=city,
            category=category,
            tags=list(tags),
            lng=lng,
            lat=lat,
            avg_cost=cost,
            rating=rating,
            address=str(item.get("address") or ""),
            opening_hours=opening_hours,
        )
        
        # Enrich with metadata
        return enrich_poi(poi, item)


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
    anti_preferences: List[str] = (),
    hard_conflict_categories: List[str] = (),
    top_k_per_category: int = 15,
    backend: Optional[POIBackend] = None,
    group_keywords: Optional[str] = None,
    per_user_keywords: Optional[Dict[str, str]] = None,
    food_keywords: Optional[List[str]] = None,
    trace_collector: Optional[Callable[[str], None]] = None,
) -> Tuple[Dict[str, List[POI]], List[str]]:
    """For each city, fetch top-K POIs across all categories implied by the
    combined trip_goals of the group. Returns ({city: [POI, ...]}, failures).

    Silent-fallback behaviour: if a single (city, category) call throws, we
    degrade to the MockPOIBackend for that category and continue. The live
    backend is reused across categories, so one cold call covers the trip.
    """
    b = backend or get_backend()
    fallback = MockPOIBackend()
    failures = []
    
    def collect_trace(msg: str):
        if trace_collector:
            trace_collector(msg)

    # 1. Determine categories based on goals
    categories = _goals_to_categories(trip_goals)
    
    # 2. Filter out categories that are strongly disliked (anti_preferences)
    # or are part of a hard conflict.
    filtered_categories = []
    for cat in categories:
        if cat in anti_preferences or cat in hard_conflict_categories:
            print(f"[poi_service] skipping category '{cat}' due to anti-preferences/conflicts", file=sys.stderr)
            continue
        filtered_categories.append(cat)
    
    # Ensure we have at least something
    if not filtered_categories:
        filtered_categories = ["景点", "美食"]

    result: Dict[str, List[POI]] = {}
    for city in cities:
        bucket: List[POI] = []
        seen_ids: Set[str] = set()
        hits = []
        
        # 3. Search each category (Non-food)
        for cat in [c for c in filtered_categories if c != "美食"]:
            items = []
            try:
                # Attempt 1: Combine category and group keywords
                if group_keywords:
                    items = b.search(city, cat, keywords=group_keywords, top_k=top_k_per_category)
                    if items:
                        hits.append(f"{cat}({group_keywords})→{len(items)}")
                
                # Attempt 2: If no results with keywords, fallback to category-only
                if not items:
                    items = b.search(city, cat, keywords=None, top_k=top_k_per_category)
                    if items:
                        hits.append(f"{cat}→{len(items)}")
            except Exception as exc:
                failures.append(f"{city}/{cat}: {exc}")
                print(f"[poi_service] {b.name} search failed for {city}/{cat}: {exc}",
                      file=sys.stderr)
                # Fallback to mock if it wasn't already mock
                if b.name != "mock":
                    items = fallback.search(city, cat, keywords=group_keywords, top_k=top_k_per_category)
                    if not items:
                        items = fallback.search(city, cat, keywords=None, top_k=top_k_per_category)
                    if items:
                        hits.append(f"{cat}(mock)→{len(items)}")
            
            for it in items:
                # Quality gate: ensure crucial metadata exists
                if not it.get("walk_km_estimate") or not it.get("duration_min"):
                    # For production robustness, we give default values instead of dropping
                    it["walk_km_estimate"] = it.get("walk_km_estimate") or 0.5
                    it["duration_min"] = it.get("duration_min") or 60

                pid = it.get("poi_id") or it.get("name")
                if pid and pid not in seen_ids:
                    seen_ids.add(pid)
                    it["target_users"] = ["all"] # Default to all
                    bucket.append(it)
        
        # 4. Search for food (Special handling)
        if "美食" in filtered_categories:
            food_items = []
            if food_keywords:
                for kw in food_keywords:
                    try:
                        # 主动控速，缓解 QPS 限流
                        time.sleep(0.2)
                        # Use a higher top_k for food keyword search
                        items = b.search(city, "美食", keywords=kw, top_k=10)
                        if items:
                            hits.append(f"美食({kw})→{len(items)}")
                        food_items.extend(items)
                    except Exception as exc:
                        failures.append(f"{city}/美食({kw}): {exc}")
                        print(f"[poi_service] food search failed for {city}/{kw}: {exc}", file=sys.stderr)
            
            # Fallback if no food found with keywords, or if we need more variety
            if not food_items or len(set(p.get("poi_id") or p.get("name") for p in food_items)) < 10:
                try:
                    # Search with generic "美食" to ensure we have enough
                    items = b.search(city, "美食", keywords=None, top_k=top_k_per_category)
                    if items:
                        hits.append(f"美食→{len(items)}")
                    food_items.extend(items)
                except Exception as exc:
                    failures.append(f"{city}/美食(generic): {exc}")
                    if b.name != "mock":
                        items = fallback.search(city, "美食", keywords=None, top_k=top_k_per_category)
                        if items:
                            hits.append(f"美食(mock)→{len(items)}")
                        food_items.extend(items)

            for it in food_items:
                pid = it.get("poi_id") or it.get("name")
                if pid and pid not in seen_ids:
                    seen_ids.add(pid)
                    it.setdefault("walk_km_estimate", 0.3)
                    it.setdefault("duration_min", 60)
                    it["target_users"] = ["all"]
                    bucket.append(it)
        
        # 5. Search for per-user keywords
        if per_user_keywords:
            for uid, user_kw in per_user_keywords.items():
                if not user_kw: continue
                try:
                    # Search in "景点" by default for user keywords
                    items = b.search(city, "景点", keywords=user_kw, top_k=5)
                    if items:
                        hits.append(f"{uid}({user_kw})→{len(items)}")
                    for it in items:
                        if not it.get("walk_km_estimate") or not it.get("duration_min"):
                            continue
                        pid = it.get("poi_id") or it.get("name")
                        if pid:
                            if pid in seen_ids:
                                # Update target_users if already seen
                                for p in bucket:
                                    if (p.get("poi_id") or p.get("name")) == pid:
                                        if "all" in p["target_users"]:
                                            p["target_users"] = [uid]
                                        elif uid not in p["target_users"]:
                                            p["target_users"].append(uid)
                                        break
                            else:
                                seen_ids.add(pid)
                                it["target_users"] = [uid]
                                bucket.append(it)
                except Exception as exc:
                    failures.append(f"{city}/user_kw({uid}): {exc}")
                    print(f"[poi_service] per-user search failed for {uid}/{user_kw}: {exc}", file=sys.stderr)

        # Trace hits
        if hits:
            collect_trace(f"[pool] {city} 关键词命中: {', '.join(hits)}")

        # 5. For selected POIs, if rating is 0, try to fetch detail (only for amap)
        if b.name == "amap":
            missing_ids = [p["poi_id"] for p in bucket if p.get("rating") == 0][:20]
            if missing_ids:
                try:
                    details = b.detail_lookup(missing_ids)
                    for p in bucket:
                        if p["poi_id"] in details:
                            detail_item = details[p["poi_id"]]
                            # Re-parse to get full fields from detail
                            updated = b._parse_poi(detail_item, city, p["category"], p["tags"])
                            p.update(updated)
                except Exception as exc:
                    failures.append(f"{city}/detail_lookup: {exc}")

        # 6. Sort by rating descending
        bucket.sort(key=lambda x: x.get("rating") or 0, reverse=True)
        result[city] = bucket
        
    return result, failures
