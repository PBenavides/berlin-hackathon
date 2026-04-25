"""Shared helpers for consuming the Claude Agent SDK stream."""

import asyncio
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


def _summarise_tool_input(tool_input: object, max_len: int = 90) -> str:
    """Render a ToolUseBlock's input dict as a one-line snippet for logs."""
    if not isinstance(tool_input, dict):
        return ""
    # Prefer human-meaningful fields when present.
    for key in ("command", "file_path", "path", "url", "query", "pattern"):
        if key in tool_input:
            value = str(tool_input[key]).replace("\n", " ")
            if len(value) > max_len:
                value = value[: max_len - 1] + "…"
            return f"{key}={value}"
    keys = ",".join(list(tool_input.keys())[:4])
    return f"keys=[{keys}]"


def _shorten(text: str, max_len: int = 140) -> str:
    """Collapse whitespace and truncate for one-line log output."""
    flat = " ".join(text.split())
    if len(flat) > max_len:
        flat = flat[: max_len - 1] + "…"
    return flat


async def run_agent(
    prompt: str,
    options: ClaudeAgentOptions,
    label: str = "agent",
) -> AgentResult:
    """Run an agent query and collect the result safely.

    Streams progress logs inside the SDK query() loop so the user can
    follow what the agent is doing in real time:
    - SystemMessage init -> session id and any model info
    - AssistantMessage   -> per text block (snippet) and per tool use
                            (tool name + a one-line argument summary)
    - ResultMessage      -> final subtype + cost

    Also handles:
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
    text_block_count = 0
    logger.info(f"[{label}] starting query (resume={getattr(options, 'resume', None)})")

    try:
        async for message in query(prompt=prompt, options=options):
            if isinstance(message, SystemMessage):
                sid = None
                if hasattr(message, "session_id") and message.session_id:
                    sid = message.session_id
                if hasattr(message, "data") and isinstance(message.data, dict):
                    sid = message.data.get("session_id") or sid
                if sid and sid != out.session_id:
                    out.session_id = sid
                    logger.info(f"[{label}] session_id={sid}")

            elif isinstance(message, AssistantMessage):
                for block in message.content:
                    # ToolUseBlock has `.name` (and `.input`).
                    if hasattr(block, "name"):
                        out.tool_calls.append(block.name)
                        arg_summary = _summarise_tool_input(
                            getattr(block, "input", None),
                        )
                        suffix = f" — {arg_summary}" if arg_summary else ""
                        logger.info(
                            f"[{label}] tool#{len(out.tool_calls)}: "
                            f"{block.name}{suffix}"
                        )
                    # TextBlock has `.text`.
                    elif hasattr(block, "text") and block.text:
                        text_block_count += 1
                        snippet = _shorten(block.text)
                        if snippet:
                            logger.info(f"[{label}] text: {snippet}")

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
                logger.info(
                    f"[{label}] result: subtype={out.subtype} "
                    f"cost=${out.cost_usd:.4f} tools={len(out.tool_calls)} "
                    f"text_blocks={text_block_count}"
                )

    except Exception as e:
        # CLI subprocess can crash during stream cleanup even after
        # a valid ResultMessage was already received.
        if out.result_text or out.tool_calls:
            logger.warning(
                f"[{label}] SDK stream error after receiving results "
                f"(ignoring): {e}"
            )
        else:
            out.is_error = True
            out.error_detail = f"SDK stream crashed: {e}"
            logger.error(f"[{label}] SDK stream crashed with no results: {e}")

    logger.info(
        f"[{label}] done: subtype={out.subtype} cost=${out.cost_usd:.4f} "
        f"tools={len(out.tool_calls)} error={out.is_error}"
    )
    return out


async def run_agent_resilient(
    prompt: str,
    options: ClaudeAgentOptions,
    max_attempts: int = 2,
    label: str = "agent",
) -> AgentResult:
    """Run an agent with in-process retry that resumes the SDK session.

    Behavior:
    - On the first attempt, calls run_agent() with the original options.
    - If the result is_error or empty AND a session_id was captured, mutates
      options.resume = session_id and retries (the agent picks up where it
      left off, same conversation context).
    - If no session_id was captured (e.g. the SDK never sent a SystemMessage
      because the subprocess died immediately), retries fresh.
    - Never raises — returns the final AgentResult so callers can decide.
    """
    attempt = 0
    last: AgentResult | None = None
    initial_resume = getattr(options, "resume", None)

    while attempt < max_attempts:
        attempt += 1
        attempt_label = f"{label}#a{attempt}"
        try:
            result = await run_agent(
                prompt=prompt, options=options, label=attempt_label,
            )
        except Exception as e:
            # Defensive: run_agent already swallows stream errors, but
            # constructor / pre-stream failures can still raise.
            logger.error(f"[{attempt_label}] attempt raised: {e}")
            result = AgentResult(is_error=True, error_detail=f"pre-stream crash: {e}")

        last = result
        # Only retry on actual errors. An empty result_text with success
        # subtype (e.g. evaluator finished via tool calls without writing
        # the JSON) is NOT an error — agent modules handle that themselves.
        if not result.is_error:
            if attempt > 1:
                logger.info(f"[{label}] recovered on attempt {attempt}")
            return result

        if attempt >= max_attempts:
            logger.error(
                f"[{label}] gave up after {attempt} attempt(s): "
                f"{result.error_detail or 'empty result'}"
            )
            return result

        # Set up the next attempt: prefer resuming the session we just
        # captured. If none, fall back to the caller's original resume value.
        resume_target = result.session_id or initial_resume
        if resume_target:
            options.resume = resume_target
            logger.warning(
                f"[{label}] attempt {attempt} failed "
                f"({result.error_detail or 'empty'}); "
                f"retrying with resume={resume_target}"
            )
        else:
            logger.warning(
                f"[{label}] attempt {attempt} failed with no session id; "
                f"retrying fresh"
            )
        # Small backoff so we don't hammer a flapping CLI subprocess.
        await asyncio.sleep(2)

    return last  # unreachable in practice
