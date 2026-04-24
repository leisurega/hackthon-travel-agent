"""Unified LLM call abstraction with USE_MOCK switch.

Every Agent node in the orchestrator calls `call_llm(...)`. When
`USE_MOCK=true` (default for the hackathon MVP) the function returns the JSON
stored in `backend/app/data/<mock_file>`. When `USE_MOCK=false` it calls the
configured provider (Qwen or DeepSeek).

Resiliency:
- If LLM returns text that fails `json.loads`, we retry once with a
  `RESPOND JSON ONLY` system reminder appended.
- Any remaining failure falls back to the provided mock_file / fallback_mock_file.
"""
from __future__ import annotations

import json
import os
import sys
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
    """Call the LLM or return the mock JSON."""
    use_mock = _use_mock_flag()
    if use_mock and not force_real:
        print(f"[llm_client] USE_MOCK=true -> reading {mock_file}", file=sys.stderr)
        return _load_mock(mock_file)

    label = "force_real" if force_real else "real"
    provider = os.getenv("LLM_PROVIDER", "qwen").lower()
    
    try:
        if provider == "deepseek":
            result = _call_deepseek(system=system, user=user, model=model)
        else:
            result = _call_qwen(system=system, user=user, model=model)
        print(f"[llm_client] {label} ({provider}) call ok (json parsed)", file=sys.stderr)
        return result
    except json.JSONDecodeError as exc:
        print(
            f"[llm_client] {label} ({provider}) returned non-JSON ({exc}); retrying with stricter reminder",
            file=sys.stderr,
        )
        try:
            stricter_system = system + "\n\n[REMINDER] RESPOND WITH PURE JSON ONLY, NO PROSE."
            if provider == "deepseek":
                result = _call_deepseek(system=stricter_system, user=user, model=model)
            else:
                result = _call_qwen(system=stricter_system, user=user, model=model)
            print(f"[llm_client] {label} ({provider}) retry ok", file=sys.stderr)
            return result
        except Exception as exc2:
            fb = fallback_mock_file or mock_file
            print(
                f"[llm_client] {label} ({provider}) retry failed ({exc2}); falling back to {fb}",
                file=sys.stderr,
            )
            return _load_mock(fb)
    except Exception as exc:
        fb = fallback_mock_file or mock_file
        print(
            f"[llm_client] {label} ({provider}) call failed ({exc}); falling back to {fb}",
            file=sys.stderr,
        )
        return _load_mock(fb)


def _call_qwen(system: str, user: str, model: Optional[str] = None) -> Dict[str, Any]:
    """Actual dashscope call."""
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


def _call_deepseek(system: str, user: str, model: Optional[str] = None) -> Dict[str, Any]:
    """Call DeepSeek via OpenAI-compatible SDK."""
    from openai import OpenAI
    
    api_key = os.getenv("DEEPSEEK_API_KEY")
    if not api_key or api_key.startswith("your_"):
        raise RuntimeError("DEEPSEEK_API_KEY not configured in .env")
        
    client = OpenAI(
        api_key=api_key,
        base_url=os.getenv("DEEPSEEK_API_BASE", "https://api.deepseek.com")
    )
    
    resp = client.chat.completions.create(
        model=model or os.getenv("DEEPSEEK_MODEL", "deepseek-chat"),
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        response_format={"type": "json_object"}
    )
    
    content = resp.choices[0].message.content
    if not content:
        raise RuntimeError("DeepSeek returned empty content")
        
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
