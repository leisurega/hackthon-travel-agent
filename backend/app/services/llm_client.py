"""Unified LLM call abstraction with USE_MOCK switch.

Every Agent node in the orchestrator calls `call_llm(...)`. When
`USE_MOCK=true` (default for the hackathon MVP) the function returns the JSON
stored in `backend/app/data/<mock_file>`. When `USE_MOCK=false` it calls Qwen
(dashscope) with the given system and user prompts.

Set `force_real=True` on a single call to always hit the real LLM regardless
of the global flag. This is used by `explainer_agent` at demo time so the
audience sees one live LLM interaction.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Dict, Optional

from dotenv import load_dotenv


load_dotenv(override=True)


_BACKEND_ROOT = Path(__file__).resolve().parent.parent
MOCK_DIR = _BACKEND_ROOT / "data"


def _load_mock(mock_file: str) -> Dict[str, Any]:
    path = MOCK_DIR / mock_file
    if not path.exists():
        raise FileNotFoundError(
            f"Mock file {path} not found. P3 needs to produce it. "
            f"See backend/app/services/orchestrator/prompts.py for the expected schema."
        )
    return json.loads(path.read_text(encoding="utf-8"))


def _use_mock_flag() -> bool:
    return os.getenv("USE_MOCK", "true").lower() == "true"


def call_llm(
    system: str,
    user: str,
    mock_file: str,
    force_real: bool = False,
    fallback_mock_file: Optional[str] = None,
    model: Optional[str] = None,
) -> Dict[str, Any]:
    """Call the LLM or return the mock JSON.

    Parameters
    ----------
    system: system prompt (see prompts.py SYS_*).
    user:   user prompt built from TripState.
    mock_file: filename under backend/app/data/ used when USE_MOCK=true.
    force_real: if True, bypass USE_MOCK and call the real LLM (used by
        explainer_agent for a demo-time live Qwen call).
    fallback_mock_file: filename to fall back to if the real LLM call fails.
        Typically `explanation_cache.json` for the explainer.
    model: optional override of the Qwen model name (defaults to env QWEN_MODEL).
    """
    use_mock = _use_mock_flag()
    if use_mock and not force_real:
        return _load_mock(mock_file)

    try:
        return _call_qwen(system=system, user=user, model=model)
    except Exception as exc:
        fb = fallback_mock_file or mock_file
        print(f"[llm_client] real LLM call failed ({exc}); falling back to {fb}")
        return _load_mock(fb)


def _call_qwen(system: str, user: str, model: Optional[str] = None) -> Dict[str, Any]:
    """Actual dashscope call. Keeps import lazy so USE_MOCK=true users don't
    need the dashscope SDK configured."""
    import dashscope
    from dashscope import Generation

    api_key = os.getenv("DASHSCOPE_API_KEY")
    if not api_key or api_key.startswith("your_"):
        raise RuntimeError("DASHSCOPE_API_KEY not configured in .env")
    dashscope.api_key = api_key

    resp = Generation.call(
        model=model or os.getenv("QWEN_MODEL", "qwen-plus"),
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        result_format="message",
    )

    if resp.status_code != 200:
        raise RuntimeError(f"Qwen call failed: status={resp.status_code} msg={resp.message}")

    content = resp.output.choices[0].message.content
    content = _strip_code_fence(content)
    return json.loads(content)


def _strip_code_fence(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        if text.endswith("```"):
            text = text[: -3]
        if text.startswith("json"):
            text = text[4:]
    return text.strip()
