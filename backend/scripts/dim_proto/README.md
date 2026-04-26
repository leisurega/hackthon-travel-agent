# 6维维度评估原型 (Dimension-based Evaluation Prototype)

本目录包含基于 `维度.txt` 定义的 6 维评估框架的独立原型实现。

## 核心维度
1. **时间与可用性 (T)**
2. **预算与消费舒适度 (B)**
3. **节奏与体力承受 (P)**
4. **兴趣覆盖与高光体验 (I)**
5. **饮食与健康安全 (F)**
6. **社交方式与自主空间 (S)**

## 运行方式
确保在 `backend` 目录下，且 `.env` 中配置了 `DASHSCOPE_API_KEY`。

```bash
cd backend
USE_MOCK=false LLM_PROVIDER=qwen \
  python -m scripts.dim_proto.run \
  --profiles app/data/profile_llm_mock.json \
  --proposal app/data/proposal_llm_mock.json \
  --out scripts/dim_proto/output
```

## 文件说明
- `prompts.py`: 维度冲突识别与方案满意度打分的 System Prompt。
- `aggregate.py`: Python 侧的权重聚合、惩罚项计算与群体评分逻辑。
- `run.py`: 串联流程的 CLI 工具。
