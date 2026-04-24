"""TripState schema shared across the LangGraph nodes and the FastAPI layer.

P1 defines this file. P2 and P3 are read-only consumers:
- P2 (frontend) uses the GET /api/trip/{id} response which mirrors this shape.
- P3 (data + scoring) must ensure every *_llm_mock.json matches the field
  names and nesting defined here so that USE_MOCK=false can be flipped without
  any other change.
"""
from __future__ import annotations

from typing import List, Optional
from typing_extensions import TypedDict


# ---------------------------------------------------------------------------
# Profile
# ---------------------------------------------------------------------------

class HardConstraints(TypedDict):
    budget_cap: int            # CNY, per person overall
    diet: List[str]            # ["不吃香菜", "素食", ...]
    daily_walk_km_max: float   # e.g. 8.0
    latest_rest_time: str      # "23:30"


class StrongPreferences(TypedDict):
    city_walking: int          # 0-100
    museum: int                # 0-100
    photography_golden_hour: int  # 0-100
    free_time: int             # 0-100


class UserProfile(TypedDict):
    user_id: str               # "A" / "B" / "C" / "D"
    display_name: str          # "A 用户"
    role: str                  # "主导成员" | "成员"
    trip_goal: List[str]       # subset of ["放松","美食","摄影","博物馆","购物","深度文化"]
    hard_constraints: HardConstraints
    strong_preferences: StrongPreferences
    anti_preferences: List[str]      # ["高密度行程","夜生活","高频换酒店"]
    negotiable_range: List[str]      # ["可接受 0-2 小时博物馆", ...]
    key_tags: List[str]              # ["放松导向","摄影偏好","预算敏感"]
    confidence: int                  # 0-100, 画像可靠度
    radar: List[int]                 # 6-dim radar values 0-100 in order:
                                      # [放松,美食,摄影,博物馆,购物,深度文化]
    completeness: int                # 0-100, 画像完整度


# ---------------------------------------------------------------------------
# Conflict
# ---------------------------------------------------------------------------

Severity = str  # "低" | "中" | "高"


class ConflictItem(TypedDict):
    conflict_id: str
    type: str                  # "节奏冲突" | "预算冲突" | "时间冲突" | "饮食冲突" | ...
    title: str                 # "节奏冲突：A 偏向慢游，B 偏向高密度打卡"
    users: List[str]           # ["A", "B"]
    severity: Severity
    description: str
    suggestion: str            # "建议：在行程中安排'慢游+打卡'组合段"
    is_hard: bool


class ConflictSummary(TypedDict):
    total: int
    high_priority: int
    hard: int
    feasibility: int           # 0-100


# ---------------------------------------------------------------------------
# Proposal (single recommended plan, not 3-way comparison in MVP)
# ---------------------------------------------------------------------------

class ActivityBlock(TypedDict, total=False):
    time: str                  # "09:00"
    title: str                 # "故宫博物院"
    kind: str                  # "museum" | "walk" | "photo" | "restaurant" | "shopping" | "transit" | ...
    is_indoor: bool
    tags: List[str]            # ["室内","文化","拍照"]
    beneficiaries: List[str]   # ["A","C"] -- users this activity primarily satisfies
    cost: int                  # CNY per person (approx)
    poi_id: str                # optional, references an entry in state["poi_pool"]


class DayPlan(TypedDict):
    day: int                   # 1..7
    city: str                  # "巴黎"
    theme: str                 # "抵达巴黎，初识浪漫之都"
    morning: ActivityBlock
    noon: ActivityBlock
    evening: ActivityBlock


class Proposal(TypedDict):
    proposal_id: str
    type: str                  # "公平优先" (MVP default)
    cities: List[str]          # ["北京","上海","杭州"]
    city_days: List[int]       # [3,2,2]
    total_budget: int          # 30000
    per_person_budget: int     # 7500
    per_person_per_day: int    # 1071
    recommendation_reasons: List[str]
    per_day: List[DayPlan]     # length = total days


# ---------------------------------------------------------------------------
# Score
# ---------------------------------------------------------------------------

class PerUserScore(TypedDict):
    user_id: str
    satisfaction: int          # 0-100
    met: List[str]             # 满足点
    gave_up: List[str]         # 妥协点
    compensation: List[str]    # 补偿点


class Score(TypedDict):
    final: int                 # 0-100, weighted composite
    F: int                     # Feasibility 0-100
    S_avg: int                 # Avg satisfaction 0-100
    S_min: int                 # Min individual satisfaction 0-100
    Fairness: int              # 0-100
    per_user: List[PerUserScore]


# ---------------------------------------------------------------------------
# Explanations (per-user impact + overall reasons)
# ---------------------------------------------------------------------------

class Explanations(TypedDict):
    recommendation_reasons: List[str]         # "满足核心偏好，冲突较少"
    per_user_impact: List[PerUserScore]       # same shape as Score.per_user


# ---------------------------------------------------------------------------
# Replan (dynamic re-routing output)
# ---------------------------------------------------------------------------

class ReplanDiff(TypedDict):
    event: str                               # "day3_rain"
    event_title: str                         # "第 3 天下雨"
    impact_range: str                        # "Day 3 户外活动"
    disturbance: str                         # "小" | "中" | "大"
    most_affected: List[str]                 # ["A:-6","B:-2","C:-1","D:0"]
    compensated: List[str]                   # ["B:+5","C:+2","D:+1","A:0"]
    how_adjusted: List[str]                  # 4 bullets, shown on the right panel
    original_day_plans: List[DayPlan]        # Only the affected days
    new_day_plans: List[DayPlan]             # Replacements / additions
    old_score: Optional[Score]
    new_score: Optional[Score]


# ---------------------------------------------------------------------------
# Top-level state
# ---------------------------------------------------------------------------

class TripState(TypedDict, total=False):
    # Input from user
    trip_id: str
    title: str
    days: int
    budget_total: int
    cities: List[str]
    member_count: int

    # Populated by profile_agent
    profiles: List[UserProfile]

    # Populated by conflict_agent
    conflicts: List[ConflictItem]
    conflict_summary: ConflictSummary
    heatmap: List[List[int]]        # 6 rows (dims) x 4 cols (users), values 0-3

    # Populated by generator_agent (and its preceding POI service call)
    poi_pool: dict                 # {city: [POI dict, ...]}
    proposal: Proposal

    # Populated by scorer_node
    scores: Score

    # Populated by explainer_agent
    explanations: Explanations

    # Populated by API when user triggers an event
    events: List[str]               # ["day3_rain"]

    # Populated by replanner_agent + rescore
    replan_diff: Optional[ReplanDiff]

    # Agent trace for frontend debug panel (appended by each node)
    agent_trace: List[str]
