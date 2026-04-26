"""Itinerary Generator Agent node.

Pre-step: fetch a real POI candidate pool (via `poi_service`) based on the
group's combined trip_goals and the target cities. The pool is stored on the
state and also inlined into the LLM user prompt so the model selects from
real venues rather than hallucinating.

Main step: invoke the LLM (or the mock JSON when USE_MOCK=true) with the
augmented prompt. The response shape is unchanged.
"""
from __future__ import annotations

import time

from ...llm_client import call_llm
from ...poi_service import build_candidate_pool, get_backend
from ..prompts import SYS_GENERATOR, user_prompt_generator
from ..state import TripState


def _collect_trip_goals(state: TripState):
    goals = []
    for p in state.get("profiles") or []:
        # V2 schema: use strong_preferences keys with high weights
        strong = p.get("strong_preferences") or {}
        for k, v in strong.items():
            if v >= 0.7 and k not in goals:
                goals.append(k)
        # Legacy compatibility
        for g in p.get("trip_goal") or []:
            if g not in goals:
                goals.append(g)
    return goals


def _collect_anti_preferences(state: TripState):
    """Collect categories that are strongly disliked by multiple members."""
    antis = []
    # Map common anti-preference strings to POI categories
    mapping = {
        "博物馆": "博物馆",
        "购物": "购物",
        "高密度行程": None, # Not a POI category
        "夜生活": None,
    }
    
    counts = {}
    profiles = state.get("profiles") or []
    for p in profiles:
        # V2 schema: use anti_preferences keys with high weights
        anti = p.get("anti_preferences") or {}
        if isinstance(anti, dict):
            for k, v in anti.items():
                if v >= 0.7:
                    counts[k] = counts.get(k, 0) + 1
        else:
            # Legacy list support
            for ap in anti:
                cat = mapping.get(ap)
                if cat:
                    counts[cat] = counts.get(cat, 0) + 1
    
    # If more than 50% members dislike it, we filter it out from the pool
    threshold = len(profiles) / 2
    for cat, count in counts.items():
        if count > threshold:
            antis.append(cat)
    return antis


def _collect_hard_conflicts(state: TripState):
    """Extract categories involved in hard conflicts."""
    hard_cats = []
    # V2 schema: use conflicts_v2 tiered_constraints
    conflicts_v2 = state.get("conflicts_v2") or {}
    for hc in conflicts_v2.get("tiered_constraints", {}).get("hard", []):
        item = hc.get("item", "")
        for cat in ["博物馆", "购物", "美食"]:
            if cat in item:
                hard_cats.append(cat)

    # Legacy compatibility
    for c in state.get("conflicts") or []:
        if c.get("is_hard"):
            # Simple heuristic: if conflict title mentions a category
            for cat in ["博物馆", "购物", "美食"]:
                if cat in c.get("title", "") or cat in c.get("type", ""):
                    hard_cats.append(cat)
    return list(set(hard_cats))


def _restaurant_count(pool: dict, city: str) -> int:
    return sum(1 for p in pool.get(city, []) if p.get("category") == "美食")

MAX_SUPPLEMENT_ROUNDS = 2

def run(state: TripState) -> TripState:
    trace = state.get("agent_trace", []) or []
    started = time.time()

    cities = state.get("cities") or ["杭州"]
    goals = _collect_trip_goals(state)
    antis = _collect_anti_preferences(state)
    hards = _collect_hard_conflicts(state)
    
    # V2: Extract keywords from state if keyword_agent ran
    keywords = state.get("keywords", {})
    group_kw = keywords.get("group_keywords")
    user_kw = keywords.get("per_user_keywords")
    food_kws = list(keywords.get("food_keywords") or [])

    poi_started = time.time()
    backend = get_backend()
    try:
        poi_pool, poi_failures = build_candidate_pool(
            cities, 
            goals, 
            anti_preferences=antis,
            hard_conflict_categories=hards,
            backend=backend,
            group_keywords=group_kw,
            per_user_keywords=user_kw,
            food_keywords=food_kws
        )
        
        if poi_failures:
            trace.append(f"[generator] POI 部分失败({len(poi_failures)} 项): {poi_failures[:3]}...")
        
        # Reflection loop for food POIs
        days = state.get("days", 7)
        needed = days * 2 # Lunch + Dinner
        from .supplement_keyword_agent import run as supplement_run
        
        for city in cities:
            round_idx = 0
            while _restaurant_count(poi_pool, city) < needed and round_idx < MAX_SUPPLEMENT_ROUNDS:
                existing = [p["name"] for p in poi_pool[city] if p.get("category") == "美食"]
                new_kws = supplement_run(state, city, existing, needed)
                if not new_kws:
                    break
                
                # IMPORTANT: force_real=True to ensure we get fresh results from Amap
                extra_pool, extra_failures = build_candidate_pool(
                    [city], [], food_keywords=new_kws, backend=backend
                )
                if extra_failures:
                    trace.append(f"[generator] {city} 餐饮补充失败: {extra_failures[:2]}...")
                
                existing_ids = {p["poi_id"] for p in poi_pool[city]}
                added = 0
                for it in extra_pool.get(city, []):
                    if it["poi_id"] not in existing_ids:
                        poi_pool[city].append(it)
                        added += 1
                
                trace.append(
                    f"[generator] {city} 餐饮不足({len(existing)}<{needed})，"
                    f"LLM 第 {round_idx+1} 轮补充关键词 {new_kws}，新增 {added} 个 POI"
                )
                round_idx += 1

        total = sum(len(v) for v in poi_pool.values())
        poi_elapsed = int((time.time() - poi_started) * 1000)
        trace.append(
            f"[generator] {backend.name} 返回 {total} 个候选 POI "
            f"（覆盖 {len(cities)} 城，已过滤 {len(antis+hards)} 类反感项） ({poi_elapsed}ms)"
        )
    except Exception as exc:
        poi_pool = {}
        poi_elapsed = int((time.time() - poi_started) * 1000)
        trace.append(
            f"[generator] POI 服务异常 ({exc})，已降级为空池 "
            f"({poi_elapsed}ms)"
        )

    state["poi_pool"] = poi_pool

    response = call_llm(
        system=SYS_GENERATOR,
        user=user_prompt_generator(state),
        mock_file="proposal_llm_mock.json",
    )

    state["proposal"] = response["proposal"]
    
    # V2: Post-generation quantification (Layer A)
    # This will be called again in evaluator_agent, but we can do a quick check here for self-correction if needed
    # For now, let's just proceed to the evaluator node in the graph
    
    elapsed = int((time.time() - started) * 1000)
    trace.append(
        f"[generator] 已生成 {len(state['proposal']['per_day'])} 天行程规划 "
        f"（{', '.join(state['proposal']['cities'])}） ({elapsed}ms)"
    )
    state["agent_trace"] = trace
    return state
