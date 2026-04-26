"""Time Fixer Agent node.

Post-processing node that runs after evaluation. If time window violations are found,
it attempts to fix them by:
1. Swapping the POI with another one from the pool (same category) that is open.
2. Shifting the activity time slightly if it doesn't break the day's flow.
3. Marking as unresolved if no easy fix is found, triggering the replanner.
"""
from __future__ import annotations

import time
from typing import Any, Dict, List
from ..state import TripState
from ..evaluation import within_open_window

def run(state: TripState) -> TripState:
    report = state.get("evaluation_report", {})
    hard_violations = report.get("hard_violations", [])
    time_violations = [v for v in hard_violations if v.get("type") == "time_window_violation"]
    
    if not time_violations:
        return state

    trace = state.get("agent_trace", []) or []
    proposal = state.get("proposal", {})
    per_day = proposal.get("per_day", [])
    poi_pool = state.get("poi_pool", {})
    
    # Flatten pool for lookup
    flat_pool = {}
    pool_by_cat = {} # {city: {category: [POI]}}
    for city, city_pois in poi_pool.items():
        pool_by_cat[city] = {}
        for p in city_pois:
            pid = p.get("poi_id") or p.get("name")
            if pid:
                flat_pool[pid] = p
            cat = p.get("category", "其他")
            if cat not in pool_by_cat[city]:
                pool_by_cat[city][cat] = []
            pool_by_cat[city][cat].append(p)

    fixed_count = 0
    unresolved_count = 0
    
    for v in time_violations:
        day_idx = v["day"]
        slot = v["slot"]
        day_plan = next((d for d in per_day if d["day"] == day_idx), None)
        if not day_plan: continue
        
        activity = day_plan.get(slot)
        if not activity: continue
        
        city = day_plan["city"]
        cat = activity.get("kind") # In proposal, kind is used for category
        # Map kind to POI category if needed
        cat_map = {"museum": "博物馆", "restaurant": "美食", "walk": "景点", "photo": "景点", "shopping": "购物"}
        poi_cat = cat_map.get(cat, cat)
        
        # Try Strategy 1: Swap POI
        candidates = pool_by_cat.get(city, {}).get(poi_cat, [])
        found_swap = False
        for cand in candidates:
            cand_open = cand.get("open_time")
            if not cand_open: continue
            
            start = activity.get("start_time") or activity.get("time")
            end = activity.get("end_time") or start
            
            if within_open_window(start, cand_open) and within_open_window(end, cand_open):
                # Found a swap!
                old_title = activity["title"]
                activity["title"] = cand["name"]
                activity["poi_id"] = cand["poi_id"]
                activity["cost"] = cand.get("avg_cost", 0)
                activity["tags"] = cand.get("tags", [])
                trace.append(f"[time_fixer] Day {day_idx} {slot}: {old_title} 营业时间冲突，已更换为 {cand['name']}")
                fixed_count += 1
                found_swap = True
                break
        
        if found_swap: continue
        
        # Try Strategy 2: Shift time (very simple logic)
        # For now, we'll just mark as unresolved and let replanner handle it
        # because shifting time might require shifting the whole day.
        unresolved_count += 1
        trace.append(f"[time_fixer] Day {day_idx} {slot}: {activity['title']} 营业时间冲突，池中无合适替代，交给 Replanner")

    if fixed_count > 0:
        state["proposal"] = proposal
        # We need to re-evaluate after fixes, but the graph will handle the loop
        # if we keep the unresolved ones as hard violations.
    
    state["agent_trace"] = trace
    return state
