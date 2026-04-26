# 6 维评估维度 (dim_proto) 覆盖度审计报告 (v2)

## 1. 评估综述
本次实验使用 `维度 2.txt` 中的 3 个新画像（林然、周屿、陈安）对 `scripts/dim_proto` 评估框架进行了端到端验证。

**结论：当前评估框架（LLM 冲突分析 + LLM 维度打分 + Python 聚合）能够有效识别核心冲突和硬约束缺失，但对新画像中的高级字段（补偿偏好、个性化权重）缺乏消费能力。**

### 核心指标摘要
- **最终状态**: `Reject` (存在 must_have 缺失 & 最低分 36.5 < 55)
- **群体总分**: 66.53
- **公平性**: 75.0
- **个人分**: 
  - 林然 (user_A): 84.0 (缺失：清晨湖边摄影)
  - 周屿 (user_B): 83.5 (缺失：茶文化体验)
  - 陈安 (user_C): 36.5 (缺失：午休；惩罚：连续妥协、无高光、保护失效)

---

## 2. 字段覆盖度矩阵

| 画像字段 | 评估器消费情况 | 审计发现 |
| :--- | :--- | :--- |
| `hard_constraints` | **完全覆盖** | LLM 准确识别了 `must_have_midday_rest` 和 `daily_walk_km_max` 的缺失。 |
| `protection_level` | **部分覆盖** | `aggregate.py` 识别了陈安为 `protected_users`，但未区分 high/medium 等级。 |
| `scoring_weights` | **未覆盖** | `aggregate.py` 仍使用全局固定权重 (0.15T+0.15B...)，忽略了个性化偏好。 |
| `compensation_preference` | **未覆盖** | LLM 未能识别“若取消 A 则补偿 B”的逻辑，导致补偿机制失效。 |
| `negotiable_range` | **部分覆盖** | LLM 在 `evidence` 中提到了博物馆时长等，但缺乏量化比对。 |
| `anti_preferences` | **完全覆盖** | LLM 识别了对高强度行程的反感，并正确计入扣分项。 |

---

## 3. 评估维度全面性分析

### 3.1 优势 (Why it works)
1. **硬约束短路**: 能够精准抓取 `must_have_missing`，这是保证规划“合理”的底线。
2. **多维热力图**: `scripts/dim_proto/run.py` 生成的 `conflict_dim.json` 能够清晰展示 [P] 节奏和 [T] 时间上的硬冲突。
3. **惩罚项机制**: `aggregate.py` 中的“连续妥协”和“无高光”惩罚非常有效，直接拉低了牺牲者（陈安）的分数，从而触发 `Reject`，倒逼 LLM 重新规划。

### 3.2 缺口 (What's missing)
1. **动态权重缺失**: 陈安对 `pace` (0.3) 的在意程度远高于林然，固定权重会导致对陈安的“节奏受损”感知不足。
2. **补偿逻辑断裂**: 林然提到“如果取消摄影，补偿半天自由时间”，目前的评估器只看“有没有摄影”，不看“没摄影时有没有给补偿”。
3. **地理位置感知弱**: 评估器对“酒店离西湖远不远”这类 `negotiable_range` 的判定较为模糊。

---

## 4. 改进清单 (Action Plan)

### A. 后端 Schema & Prompt 升级
1. **同步 UserProfile**: 将 `protection_level` 和 `scoring_weights` 正式加入 `state.py`。
2. **增强评分 Prompt**: 在 `SYS_DIM_USER_SCORE` 中加入对 `compensation_preference` 的解析要求。

### B. 聚合算法 (aggregate.py) 优化
1. **个性化权重聚合**: 修改 `aggregate_scores` 函数，优先读取 `user.scoring_weights`。
2. **保护等级加成**: 对 `protection_level: high` 的用户，提高“硬约束受损”的惩罚系数（例如从 -20 升至 -40）。

### C. UI 适配
1. **MemberPool 升级**: 按照 `维度 2.txt` 的结构重构输入表单。
2. **冲突预览**: 在 `Conflicts.tsx` 中展示 6 维热力图（目前已部分实现，需对齐字段名）。

---

## 5. 判定结论
**全面性: 85% | 准确性: 80%**
这套维度**足够**让 LLM 出合理的规划，但需要通过**个性化权重**和**补偿逻辑**的闭环，才能达到“公平”的极致。
