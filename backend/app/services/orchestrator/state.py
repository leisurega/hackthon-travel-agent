"""TripState schema shared across the LangGraph nodes and the FastAPI layer.

P1 defines this file. P2 and P3 are read-only consumers:
- P2 (frontend) uses the GET /api/trip/{id} response which mirrors this shape.
- P3 (data + scoring) must ensure every *_llm_mock.json matches the field
  names and nesting defined here so that USE_MOCK=false can be flipped without
  any other change.
"""
from __future__ import annotations

from typing import List, Optional, Dict, Any
from typing_extensions import TypedDict


# ---------------------------------------------------------------------------
# Events & History
# ---------------------------------------------------------------------------

class EventItem(TypedDict, total=False):
    id: str                     # uuid4 hex
    type: str                   # "poi_closed" | "member_drop" | "schedule_shift" | "custom"
    title: str                  # Human readable title
    params: Dict[str, Any]      # Event specific parameters
    occurs_on_day: int          # 1-based day index
    created_at: str             # ISO timestamp
    applied_in_revision: int    # Which proposal revision this event was first applied in


class ProposalSnapshot(TypedDict):
    revision: int               # 0 for baseline, 1+ for replans
    created_at: str             # ISO timestamp
    proposal: Proposal
    triggered_by_event_ids: List[str] # IDs of events that triggered this revision


# ---------------------------------------------------------------------------
# Profile
# ---------------------------------------------------------------------------

class CompensationPreference(TypedDict):
    trigger: str               # "未拍到日落"
    action: str                # "次日清晨独自西湖摄影 90min"
    pref_key: Optional[str]    # optional link to a strong_preference key


class UserProfile(TypedDict):
    user_id: str               # "A" / "B" / "C" / "D"
    display_name: str          # "A 用户"
    role: str                  # "主导成员" | "成员"
    role_tag: Optional[str]    # "西湖摄影慢游型"
    protection_level: str      # "high" | "medium" | "low"
    core_story: Optional[str]  # "画像背景描述"
    
    # 6-dimension structure
    hard_constraints: dict     # {budget_max: 5000, walk_km_max: 6.0, dietary: [], ...}
    strong_preferences: dict   # {photography: 1.0, museum: 0.8, ...} (0-1 range)
    anti_preferences: dict     # {crowds: 1.0, coriander: 1.0, ...} (0-1 range)
    negotiable_range: dict     # {museum_hours: [0, 2], ...}
    
    scoring_weights: dict      # {T: 0.15, B: 0.15, P: 0.20, I: 0.25, F: 0.15, S: 0.10}
    compensation_preference: List[CompensationPreference]


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
    start_time: str            # "09:00"
    end_time: str              # "12:00"
    time: str                  # Legacy field, same as start_time
    title: str                 # "故宫博物院"
    kind: str                  # "museum" | "walk" | "photo" | "restaurant" | "shopping" | "transit" | ...
    is_indoor: bool
    tags: List[str]            # ["室内","文化","拍照"]
    beneficiaries: List[str]   # ["A","C"] -- users this activity primarily satisfies
    cost: int                  # CNY per person (approx)
    poi_id: str                # optional, references an entry in state["poi_pool"]
    selection_rationale: str   # Why this POI was chosen


class DayPlan(TypedDict):
    day: int                   # 1..7
    city: str                  # "巴黎"
    theme: str                 # "抵达巴黎，初识浪漫之都"
    morning: ActivityBlock      # 09:00 主活动
    lunch: ActivityBlock        # 12:00 午餐
    afternoon: ActivityBlock    # 15:00 下午活动
    dinner: ActivityBlock       # 18:00 晚餐
    night: ActivityBlock        # 20:00 夜间活动（夜游/酒吧/夜市/灯光秀）


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
    trade_off_summary: List[str]             # List of compromises made


# ---------------------------------------------------------------------------
# Replan (dynamic re-routing output)
# ---------------------------------------------------------------------------

class ReplanDiff(TypedDict, total=False):
    # New fields (incremental replan)
    event_summary: str
    original_dirty_plans: List[DayPlan]
    new_dirty_plans: List[DayPlan]
    # Legacy fields (kept for back-compat with ProposalDetail page)
    event: str                               # "day3_rain"
    event_title: str                         # "第 3 天下雨"
    original_day_plans: List[DayPlan]        # Only the affected days
    new_day_plans: List[DayPlan]             # Replacements / additions
    # Common fields
    impact_range: str                        # "Day 3 户外活动"
    disturbance: str                         # "小" | "中" | "大"
    most_affected: List[str]                 # ["A:-6","B:-2","C:-1","D:0"]
    compensated: List[str]                   # ["B:+5","C:+2","D:+1","A:0"]
    how_adjusted: List[str]                  # 4 bullets, shown on the right panel
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
    start_date: str                 # "2026-04-25"
    baseline_proposal: Optional[Proposal]
    proposal_history: List[ProposalSnapshot]
    events: List[EventItem]         # List of EventItem instead of str

    # Populated by replanner_agent + rescore
    replan_diff: Optional[ReplanDiff]

    # Lifecycle
    adopted_at: Optional[str]       # ISO timestamp when user adopted the plan

    # Agent trace for frontend debug panel (appended by each node)
    agent_trace: List[str]

    # Replan-time hints (set by API, consumed by replanner_agent, cleared after use)
    anchor_day: int
    new_event_ids: List[str]

    # V2 Evaluation & Conflicts
    conflicts_v2: Optional[dict]
    keywords: Optional[dict]
    evaluation_report: Optional[dict]
