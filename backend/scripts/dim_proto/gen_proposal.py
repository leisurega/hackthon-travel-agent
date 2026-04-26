import json
import os
import sys
from pathlib import Path

# Add backend to sys.path
sys.path.append(str(Path(__file__).resolve().parent.parent.parent))

from app.services.llm_client import call_llm
from app.services.orchestrator.prompts import SYS_GENERATOR
from app.services.poi_service import build_candidate_pool, get_backend

def main():
    input_dir = Path(__file__).parent / "input"
    profiles_path = input_dir / "profiles_v2.json"
    output_path = input_dir / "proposal_v2.json"

    with open(profiles_path, 'r', encoding='utf-8') as f:
        profiles_data = json.load(f)
    
    profiles = profiles_data["profiles"]
    
    # 1. Build POI pool for Hangzhou
    print("[*] Loading conflicts and building POI pool for Hangzhou...")
    
    # Load conflicts
    conflicts_path = Path(__file__).parent.parent / "dim_proto" / "output_v2" / "conflict_dim.json"
    conflicts = {}
    if conflicts_path.exists():
        with open(conflicts_path, 'r', encoding='utf-8') as f:
            conflicts = json.load(f)
    
    # Extract keywords using LLM
    print("[*] Extracting keywords for POI search...")
    kw_sys = "你是旅行规划助手。请根据成员画像，提取 3-5 个用于高德地图搜索的中文关键字（用 | 分隔）。关注共性需求（如清淡饮食）和核心个性需求（如摄影、茶文化）。严格输出 JSON 格式，包含 keywords 字段。"
    kw_user = f"画像：{json.dumps(profiles, ensure_ascii=False)}"
    kw_res = call_llm(system=kw_sys, user=kw_user, mock_file="kw_mock.json", force_real=True)
    keywords = kw_res.get("keywords", "杭州景点|杭帮菜|清淡饮食")
    print(f"[*] Keywords: {keywords}")

    # Enhanced POI search with keywords
    backend = get_backend()
    poi_pool = {}
    for city in ["杭州"]:
        try:
            # If backend is Amap, use keywords
            if hasattr(backend, "search"):
                # We need to modify poi_service or use a custom search here
                # For this script, we'll try to use the keywords directly if possible
                # or just use the standard build_candidate_pool but with more goals
                goals = ["放松", "摄影", "美食", "深度文化"]
                poi_pool = build_candidate_pool([city], goals, backend=backend)
        except Exception as e:
            print(f"POI search failed: {e}")
            poi_pool = {}
    
    # 2. Call LLM to generate proposal
    print("[*] Calling LLM to generate proposal v3...")
    
    SYS_GENERATOR_V3 = """你是「多人旅行协同 Agent」里的 Itinerary Generator Agent (V3 约束驱动版)。
职责：基于画像、冲突列表、硬约束、补偿偏好和 POI 池，生成 1 套公平优先且严控红线的方案。

核心原则：
1. **保护型用户红线**：识别 `protection_level: high` 的成员（如陈安）。其 `hard_constraints`（如步行 < 6km, 必须午休 90min, 22:00 前回酒店）是绝对红线，违反即方案无效。
2. **个人预算校验**：确保每位成员的分摊成本不得超过其 `hard_constraints.budget_max`。
3. **补偿机制**：如果某天因为团队行程牺牲了某人的 `strong_preferences`（如林然没拍到日落），必须在后续日程中按照其 `compensation_preference` 安排补偿。
4. **强度估算**：请在心中估算每个 Activity 的步行强度。大景区（西溪湿地、灵隐寺）按 3-5km 计，城市漫步按 1-2km 计。确保陈安每日总计 ≤ 6km。
5. **共性优先**：餐饮优先选择满足所有人要求的（如清淡、无香菜、无生食）。

期望输出格式同 SYS_GENERATOR。
"""

    state = {
        "title": "杭州 3 人协同深度游 v3",
        "days": 7,
        "budget_total": 15000,
        "cities": ["杭州"],
        "profiles": profiles,
        "conflicts": conflicts.get("dimension_conflicts", []),
        "poi_pool": poi_pool
    }

    user_prompt = f"""请为以下 3 位成员生成杭州 7 天方案。

【特别注意：硬约束清单】
{json.dumps(conflicts.get('tiered_constraints', {}).get('hard', []), ensure_ascii=False, indent=2)}

【专家建议】
{json.dumps([c['suggestion'] for c in conflicts.get('dimension_conflicts', [])], ensure_ascii=False, indent=2)}

成员画像：
{json.dumps(profiles, ensure_ascii=False, indent=2)}

POI 候选池：
{json.dumps(poi_pool, ensure_ascii=False, indent=2)}

请输出 JSON。
"""

    response = call_llm(
        system=SYS_GENERATOR_V3,
        user=user_prompt,
        mock_file="proposal_v3_fallback.json",
        force_real=True
    )

    output_path = input_dir / "proposal_v3.json"
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(response, f, ensure_ascii=False, indent=2)
    
    print(f"[*] Proposal generated and saved to {output_path}")

if __name__ == "__main__":
    main()
