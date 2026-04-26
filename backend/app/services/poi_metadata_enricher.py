"""POI metadata enricher.

Adds walk_km_estimate, duration_min, cost_estimate, dietary_tags, and open_time
to POI objects based on Amap raw data and general heuristics.
"""
from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

def enrich_poi(poi: Dict[str, Any], raw_item: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Enrich a POI with metadata for quantification.
    
    Data sources:
    1. raw_item (from Amap API)
    2. poi (existing fields)
    3. Heuristics based on category/type
    """
    # 1. walk_km_estimate
    # Heuristics: 5A=4km, 4A=2.5km, 3A=1.5km, Restaurant=0.3km, Tea=0.3km, Park=1.5km, Temple=2.0km
    walk_km = 0.5 # Default
    category = poi.get("category", "")
    name = poi.get("name", "")
    
    # Try to detect level from name or raw tags
    raw_tags = ""
    if raw_item:
        raw_tags = raw_item.get("tag", "") or ""
    
    if "5A" in name or "5A" in raw_tags:
        walk_km = 4.0
    elif "4A" in name or "4A" in raw_tags:
        walk_km = 2.5
    elif "3A" in name or "3A" in raw_tags:
        walk_km = 1.5
    elif category == "美食" or "餐厅" in name:
        walk_km = 0.3
    elif "茶" in name or "咖啡" in name:
        walk_km = 0.3
    elif category == "博物馆":
        walk_km = 1.5
    elif category == "公园":
        walk_km = 2.0
    elif "寺" in name or "观" in name:
        walk_km = 2.0
    elif "步行街" in name or "河坊街" in name:
        walk_km = 2.5
    
    poi["visit_walk_km"] = walk_km
    poi["walk_km_estimate"] = walk_km # Keep for back-compat

    # 2. duration_min
    duration = 60 # Default
    if walk_km >= 3.0:
        duration = 240
    elif walk_km >= 2.0:
        duration = 180
    elif walk_km >= 1.0:
        duration = 120
    elif category == "美食":
        duration = 60
    elif "茶" in name or "咖啡" in name:
        duration = 90
    
    poi["duration_min"] = duration

    # 3. cost_estimate
    # Already parsed as avg_cost in poi_service, but we ensure it's here
    poi["cost_estimate"] = poi.get("avg_cost", 0)
    if poi["cost_estimate"] == 0:
        # Fallback based on category
        if category == "美食":
            poi["cost_estimate"] = 80
        elif category == "景点" or category == "博物馆":
            if walk_km >= 2.5: poi["cost_estimate"] = 100
            else: poi["cost_estimate"] = 30

    # 4. dietary_tags
    dietary = []
    if category == "美食" and raw_item:
        cuisine = raw_item.get("cuisine", "")
        if cuisine:
            dietary.extend(cuisine.split(";"))
        tags = raw_item.get("tag", "")
        if tags:
            dietary.extend(tags.split(";"))
    poi["dietary_tags"] = list(set(dietary))

    # 5. open_time
    # Standardize opening hours
    raw_hours = poi.get("opening_hours", "")
    poi["open_time"] = {"start": "09:00", "end": "21:00"} # Default
    if raw_hours:
        # Simple regex to extract first time range like 09:00-22:00
        match = re.search(r"(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})", raw_hours)
        if match:
            poi["open_time"] = {"start": match.group(1), "end": match.group(2)}

    return poi
