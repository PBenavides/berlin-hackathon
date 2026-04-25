"""Shared helpers for consuming the Claude Agent SDK stream."""

import logging
from dataclasses import dataclass, field

from claude_agent_sdk import (
    query,
    ClaudeAgentOptions,
    ResultMessage,
    SystemMessage,
    AssistantMessage,
)

from src.hooks.hook_loader import load_hooks

logger = logging.getLogger("ai_builder.sdk")

# Load Entire hooks once at import time
_ENTIRE_HOOKS = load_hooks()


@dataclass
class AgentResult:
    """Result from an agent run."""
    result_text: str = ""
    session_id: str | None = None
    subtype: str = ""
    cost_usd: float = 0.0
    tool_calls: list[str] = field(default_factory=list)
    is_error: bool = False
    error_detail: str = ""


async def run_agent(prompt: str, options: ClaudeAgentOptions) -> AgentResult:
    """Run an agent query and collect the result safely.

    Wraps the SDK stream to handle:
    - CLI subprocess crashes during cleanup
    - error_max_turns and other non-success subtypes
    - Empty results

    Automatically injects Entire hooks into the agent options.
    """
    # Merge Entire hooks into the options
    if _ENTIRE_HOOKS:
        existing = options.hooks or {}
        merged = {**_ENTIRE_HOOKS}
        for event, matchers in existing.items():
            if event in merged:
                merged[event] = merged[event] + matchers
            else:
                merged[event] = matchers
        options.hooks = merged

    out = AgentResult()

    try:
        async for message in query(prompt=prompt, options=options):
            if isinstance(message, SystemMessage):
                if hasattr(message, "session_id") and message.session_id:
                    out.session_id = message.session_id
                # Also check data dict for session_id (init message)
                if hasattr(message, "data") and isinstance(message.data, dict):
                    sid = message.data.get("session_id")
                    if sid:
                        out.session_id = sid

            elif isinstance(message, AssistantMessage):
                for block in message.content:
                    if hasattr(block, "name"):
                        out.tool_calls.append(block.name)

            elif isinstance(message, ResultMessage):
                out.session_id = message.session_id or out.session_id
                out.subtype = message.subtype or ""
                out.cost_usd = message.total_cost_usd or 0.0
                out.result_text = message.result or ""

                if message.subtype == "success":
                    out.is_error = False
                else:
                    out.is_error = True
                    out.error_detail = f"{message.subtype}: {message.result or '(no detail)'}"

    except Exception as e:
        # CLI subprocess can crash during stream cleanup even after
        # a valid ResultMessage was already received.
        if out.result_text or out.tool_calls:
            logger.warning(
                f"SDK stream error after receiving results (ignoring): {e}"
            )
        else:
            out.is_error = True
            out.error_detail = f"SDK stream crashed: {e}"
            logger.error(f"SDK stream crashed with no results: {e}")

    logger.info(
        f"Agent done: subtype={out.subtype} cost=${out.cost_usd:.4f} "
        f"tools={len(out.tool_calls)} error={out.is_error}"
    )
    return out
