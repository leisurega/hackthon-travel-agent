"""Prompt templates for every LLM-driven Agent node.

P3 uses the `EXPECTED_OUTPUT_SCHEMA_*` strings in this file to build the
matching `*_llm_mock.json` files under backend/app/data/. When USE_MOCK=false
is flipped on, the exact same shape comes out of Qwen.

Each node exposes two things:
  1. SYS_<NODE>                -- system prompt (role + output contract)
  2. user_prompt_<node>(state) -- builds the user prompt from TripState
"""
from __future__ import annotations

import json
from typing import List

from .state import TripState, UserProfile


# ===========================================================================
# 1. profile_agent
# ===========================================================================

SYS_PROFILE = """你是「多人旅行协同 Agent」里的 Profile Agent。
职责：把每位成员的自然语言描述解析成结构化的个人画像。
严格输出 JSON，不要 markdown、不要额外解释。

期望输出 schema：
{
  "profiles": [
    {
      "user_id": "A",
      "display_name": "A 用户",
      "role": "主导成员" 或 "成员",
      "trip_goal": ["放松","美食","摄影"],
      "hard_constraints": {
        "budget_cap": 12000,
        "diet": ["不吃香菜"],
        "daily_walk_km_max": 8,
        "latest_rest_time": "23:30"
      },
      "strong_preferences": {
        "city_walking": 85,
        "museum": 60,
        "photography_golden_hour": 95,
        "free_time": 70
      },
      "anti_preferences": ["高密度行程","夜生活","高频换酒店"],
      "negotiable_range": ["可接受 0-2 小时博物馆","可接受酒店稍远","可接受分头行动"],
      "key_tags": ["放松导向","摄影偏好","预算敏感","夜生活低兴趣","不喜欢高强度行程"],
      "confidence": 82,
      "radar": [80, 60, 90, 50, 30, 70],
      "completeness": 82
    }
  ]
}

必须有 4 个 profile，user_id 为 A/B/C/D。
radar 顺序：[放松, 美食, 摄影, 博物馆, 购物, 深度文化]，每项 0-100。
"""


def user_prompt_profile(state: TripState) -> str:
    member_count = state.get("member_count", 4)
    return (
        f"行程标题：{state.get('title','')}\n"
        f"成员数量：{member_count}\n"
        f"请为 A/B/C/D 四位成员各生成一份完整画像。\n"
        f"4 人人设参考：A 慢游拍照型 / B 博物馆深度型 / C 预算紧控制型 / D 购物自由型。"
    )


EXPECTED_OUTPUT_SCHEMA_PROFILE = """见 SYS_PROFILE，顶层是 {"profiles": [UserProfile x 4]}"""


# ===========================================================================
# 2. conflict_agent
# ===========================================================================

SYS_CONFLICT = """你是「多人旅行协同 Agent」里的 Conflict Agent。
职责：对比 4 份成员画像，识别他们之间的冲突，输出冲突卡片列表、冲突热力矩阵、顶部摘要。
严格输出 JSON，不要 markdown、不要额外解释。

期望输出 schema：
{
  "conflicts": [
    {
      "conflict_id": "c1",
      "type": "节奏冲突",
      "title": "节奏冲突：A 偏向慢游，B 偏向高密度打卡",
      "users": ["A","B"],
      "severity": "高",
      "description": "A 偏向慢游，B 偏向高密度打卡",
      "suggestion": "建议：在行程中安排'慢游+打卡'组合段，平衡节奏。",
      "is_hard": false
    }
  ],
  "conflict_summary": {
    "total": 12,
    "high_priority": 4,
    "hard": 2,
    "feasibility": 71
  },
  "heatmap": [
    [0, 1, 2, 2],
    [1, 2, 1, 0],
    [2, 3, 0, 1],
    [0, 1, 2, 1],
    [2, 0, 2, 1],
    [1, 0, 1, 0]
  ]
}

heatmap 是 6 行 x 4 列整数矩阵：
- 行顺序: [预算, 时间, 节奏, 兴趣, 饮食, 社交]
- 列顺序: [A, B, C, D]
- 取值: 0=无冲突, 1=低, 2=中, 3=高
severity 只能是 "低" / "中" / "高"。
"""


def user_prompt_conflict(profiles: List[UserProfile]) -> str:
    return (
        "以下是 4 位成员的完整画像，请识别他们之间的冲突并输出 JSON：\n\n"
        + json.dumps(profiles, ensure_ascii=False, indent=2)
    )


EXPECTED_OUTPUT_SCHEMA_CONFLICT = """见 SYS_CONFLICT，顶层是 {"conflicts": [...], "conflict_summary": {...}, "heatmap": 6x4}"""


# ===========================================================================
# 3. generator_agent
# ===========================================================================

SYS_GENERATOR = """你是「多人旅行协同 Agent」里的 Itinerary Generator Agent。
职责：基于 4 份画像 + 冲突列表 + 预算 + 候选城市 + **POI 候选池**，生成 1 套公平优先的推荐方案。
严格输出 JSON，不要 markdown、不要额外解释。

期望输出 schema：
{
  "proposal": {
    "proposal_id": "p1",
    "type": "公平优先",
    "cities": ["北京","上海","杭州"],
    "city_days": [3, 2, 2],
    "total_budget": 30000,
    "per_person_budget": 7500,
    "per_person_per_day": 1071,
    "recommendation_reasons": [
      "满足核心偏好，冲突较少",
      "日程节奏适中，体验丰富",
      "预算控制良好，性价比高",
      "公平指数高 (0.82)"
    ],
    "per_day": [
      {
        "day": 1,
        "city": "北京",
        "theme": "抵达北京，天安门故宫中轴线",
        "morning": {
          "time": "10:00",
          "title": "抵达北京，酒店放行李",
          "kind": "transit",
          "is_indoor": true,
          "tags": ["入住"],
          "beneficiaries": ["A","B","C","D"],
          "cost": 0,
          "poi_id": "bj_hotel_wangfujing"
        },
        "noon":   { ... 同上 },
        "evening":{ ... 同上 }
      }
    ]
  }
}

硬性约束：
- **每个 ActivityBlock 的 title / poi_id 必须来自下方 POI 候选池，严禁创造池外 POI**（transit/入住除外）。
- ActivityBlock.tags 须从对应 POI 的 tags 中选择，再按需补充 1-2 个情境标签。
- per_day 长度等于 sum(city_days)（默认 7 天）。
- morning/noon/evening 每个 ActivityBlock 必须有完整字段：time/title/kind/is_indoor/tags/beneficiaries/cost/poi_id。
- beneficiaries 用 user_id 字母 ["A","B","C","D"] 的子集，按该 POI 的 tags 与画像匹配结果选取。
- 总成本 sum(cost) 不得超过 budget。
- 注重公平：每个成员至少应在 3 天里出现在 beneficiaries 中，且每个 trip_goal 至少命中 2 次。
"""


def user_prompt_generator(state: TripState) -> str:
    poi_pool = state.get("poi_pool") or {}
    if poi_pool:
        pool_part = (
            f"POI 候选池（只能从中选，poi_id 必须照搬）：\n"
            f"{json.dumps(poi_pool, ensure_ascii=False, indent=2)}\n\n"
        )
    else:
        pool_part = "POI 候选池：暂无（允许基于常识生成，但标注 poi_id=null）\n\n"

    return (
        f"目的地范围：{state.get('cities', ['北京','上海','杭州'])}\n"
        f"天数：{state.get('days', 7)}\n"
        f"总预算：{state.get('budget_total', 30000)} CNY\n\n"
        f"成员画像：\n{json.dumps(state.get('profiles', []), ensure_ascii=False, indent=2)}\n\n"
        f"冲突列表：\n{json.dumps(state.get('conflicts', []), ensure_ascii=False, indent=2)}\n\n"
        f"{pool_part}"
        f"请输出 1 套公平优先的推荐方案。"
    )


EXPECTED_OUTPUT_SCHEMA_GENERATOR = """见 SYS_GENERATOR，顶层是 {"proposal": Proposal}"""


# ===========================================================================
# 4. explainer_agent  -- default uses force_real=True (real Qwen at demo time)
# ===========================================================================

SYS_EXPLAINER = """你是「多人旅行协同 Agent」里的 Explainer Agent。
职责：把方案的决策取舍翻译成 4 位成员能一眼看懂的影响说明。
严格输出 JSON，不要 markdown、不要额外解释。

期望输出 schema：
{
  "recommendation_reasons": [
    "<不超过 20 字>",
    "<不超过 20 字>",
    "<不超过 20 字>",
    "<不超过 20 字>"
  ],
  "per_user_impact": [
    {
      "user_id": "A",
      "satisfaction": 88,
      "met": ["<不超过 25 字>"],
      "gave_up": ["<不超过 25 字>"],
      "compensation": ["<不超过 25 字>"]
    },
    { "user_id": "B", ... },
    { "user_id": "C", ... },
    { "user_id": "D", ... }
  ]
}

语气要求：客观、决策感强、不用营销辞。
"""


def user_prompt_explainer(state: TripState) -> str:
    return (
        f"方案：\n{json.dumps(state.get('proposal', {}), ensure_ascii=False, indent=2)}\n\n"
        f"评分：\n{json.dumps(state.get('scores', {}), ensure_ascii=False, indent=2)}\n\n"
        f"画像：\n{json.dumps(state.get('profiles', []), ensure_ascii=False, indent=2)}\n\n"
        f"请输出 4 位成员的影响说明和 4 条总体推荐理由。"
    )


EXPECTED_OUTPUT_SCHEMA_EXPLAINER = """见 SYS_EXPLAINER，顶层是 {"recommendation_reasons": [...], "per_user_impact": [PerUserScore x 4]}"""


# ===========================================================================
# 5. replanner_agent
# ===========================================================================

SYS_REPLANNER = """你是「多人旅行协同 Agent」里的 Replanner Agent。
职责：突发事件触发后，对原方案做最小扰动调整。
严格输出 JSON，不要 markdown、不要额外解释。

期望输出 schema：
{
  "replan_diff": {
    "event": "day3_rain",
    "event_title": "第 3 天下雨",
    "impact_range": "Day 3 户外活动",
    "disturbance": "小",
    "most_affected": ["A:-6","B:-2","C:-1","D:0"],
    "compensated":   ["B:+5","C:+2","D:+1","A:0"],
    "how_adjusted": [
      "将 Day 3 户外活动替换为室内行程",
      "延排日落拍摄至 Day 4 作为补偿",
      "保持总预算与每日节奏基本不变",
      "最小化成员偏好与体验扰动"
    ],
    "original_day_plans": [ { day:3, ... 原 DayPlan } ],
    "new_day_plans":      [ { day:3, ... 新 DayPlan }, { day:4, ... 调整后 DayPlan } ]
  },
  "new_proposal": { ... 完整的新 Proposal，替换 state.proposal ... }
}

约束：
- most_affected / compensated 的 key 顺序都是 A/B/C/D，值形如 "+5" / "-6" / "0"。
- disturbance 只能是 "小" / "中" / "大"。
- new_proposal 只需调整 Day 3 和 Day 4，其他日保持不变。
"""


def user_prompt_replanner(state: TripState) -> str:
    event = state.get("events", ["day3_rain"])[0] if state.get("events") else "day3_rain"
    return (
        f"事件：{event}\n\n"
        f"原方案：\n{json.dumps(state.get('proposal', {}), ensure_ascii=False, indent=2)}\n\n"
        f"原评分：\n{json.dumps(state.get('scores', {}), ensure_ascii=False, indent=2)}\n\n"
        f"请输出最小扰动的新方案 + diff 说明。新方案评分应略高于原方案（因为更贴合当天体验）。"
    )


EXPECTED_OUTPUT_SCHEMA_REPLANNER = """见 SYS_REPLANNER，顶层是 {"replan_diff": ReplanDiff, "new_proposal": Proposal}"""
