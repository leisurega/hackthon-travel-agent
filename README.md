# 多人旅行协同 Agent (Travel Coordination Agent)

> Personal-Agent-Native Coordination System (旅行场景版)

一个基于多个个人 Agent 画像的多人旅行协同中间层，能够识别冲突、生成方案、进行公平打分，并在突发变化下完成可解释的最小重排。

## 架构概览

```
前端 React (5 页面) -- HTTP --> FastAPI --> LangGraph StateGraph
                                            ├── profile_agent    (LLM 抽取画像)
                                            ├── conflict_agent   (LLM 识别冲突)
                                            ├── generator_agent  (LLM 生成方案)
                                            ├── scorer_node      (纯 Python 评分)
                                            ├── explainer_agent  (LLM 生成解释)
                                            └── replanner_agent  (LLM 最小扰动重排)
```

## 核心原则

**"数据可以 mock，流程不能 mock"** — 每个 Agent 节点保留完整 `build_prompt + call_llm + parse` 三段式，MVP 通过 `USE_MOCK=true` 开关让 LLM 响应替换为预置 JSON，生产时翻转 `USE_MOCK=false` 零代码改动切到真实 Qwen。

## 目录结构

```
hackthon-travel-agent/
├── backend/
│   ├── app/
│   │   ├── main.py                         FastAPI 入口
│   │   ├── api/trip.py                     3 个 API 端点
│   │   ├── services/
│   │   │   ├── llm_client.py               Qwen 封装 + USE_MOCK 开关
│   │   │   └── orchestrator/
│   │   │       ├── state.py                TripState schema
│   │   │       ├── graph.py                LangGraph 编排
│   │   │       ├── prompts.py              5 个节点 prompt 模板
│   │   │       ├── scoring.py              评分公式
│   │   │       └── agents/                 5 个 Agent 节点
│   │   └── data/                           mock JSON (模拟 LLM 输出)
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── pages/                          5 个页面
│       ├── components/                     通用组件
│       └── api/trip.ts                     API client
└── docs/
```

## 快速开始

### 后端

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# 默认 USE_MOCK=true，不需要 Qwen Key 也能跑
# 排除 data 目录的热重载，防止持久化 JSON 写入导致无限循环重启
uvicorn app.main:app --reload --reload-dir app --reload-exclude "app/data/*" --port 8000
```

### 前端

```bash
cd frontend
npm install
npm run dev
```

## 分工

- **P1 后端 Agent 编排**：LangGraph + 5 节点 + FastAPI
- **P2 前端**：React 5 页面 + 组件
- **P3 数据 + 评分**：5 份 LLM mock JSON + scoring.py + Qwen 预生成

详见 `docs/design/`。
