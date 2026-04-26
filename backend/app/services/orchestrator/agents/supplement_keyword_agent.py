"""Supplement Keyword Agent node.

Reflects on existing food POIs and generates new keywords to fill gaps.
"""
from __future__ import annotations

import json
from typing import List

from ...llm_client import call_llm
from ..prompts import TripState

SYS_SUPPLEMENT = """你是餐饮关键词反思器。
职责：分析现有餐厅列表覆盖了什么菜系/价位/风格，反思缺什么，输出新的搜索关键词。
约束：
- 必须避开成员 anti_preferences / 饮食硬约束。
- 与 existing 列表重合度高的关键词不要再用。
- 输出 3-5 个新关键词。
严格输出 JSON，不要 markdown、不要额外解释。

期望输出 schema：
{
  "new_food_keywords": ["品类1", "品类2", "品类3"],
  "reasoning": "由于现有列表全是高档杭帮菜，缺乏地道小吃和中价位面馆，因此补充..."
}
"""

def run(state: TripState, city: str, existing_food: List[str], target_count: int, trace: Optional[List[str]] = None) -> List[str]:
    profiles = state.get("profiles", [])
    user_prompt = (
        f"城市：{city}\n"
        f"目标餐厅数：{target_count}\n"
        f"当前已搜到（{len(existing_food)} 家）：{existing_food}\n"
        f"成员画像：{json.dumps(profiles, ensure_ascii=False)}\n"
        f"请反思缺什么，给出新关键词。"
    )
    
    try:
        resp = call_llm(
            system=SYS_SUPPLEMENT,
            user=user_prompt,
            mock_file="supplement_kw_mock.json",
        )
        new_kws = resp.get("new_food_keywords", [])
        if trace is not None:
            reasoning = resp.get("reasoning", "")
            trace.append(f"[supplement] {city} 反思: {reasoning[:60]}... → 新增关键词 {new_kws}")
        return new_kws
    except Exception:
        return []
