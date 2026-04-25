"""Hook loader: reads entire_hooks.json and converts to SDK HookMatcher objects.

Transforms the JSON-defined shell command hooks into async Python callables
that the Claude Agent SDK can execute during agent sessions.
"""

import asyncio
import json
import logging
import shutil
import subprocess
from pathlib import Path

from claude_agent_sdk import HookMatcher

logger = logging.getLogger("ai_builder.hooks")

_HOOKS_FILE = Path(__file__).resolve().parent / "entire_hooks.json"

# SDK hook event names that map to JSON keys
# JSON uses "SessionStart"/"SessionEnd" but SDK doesn't expose those as hook events.
# SDK hooks: PreToolUse, PostToolUse, PostToolUseFailure, UserPromptSubmit,
#            Stop, SubagentStop, PreCompact, Notification, SubagentStart, PermissionRequest
_SDK_HOOK_EVENTS = {
    "PreToolUse", "PostToolUse", "PostToolUseFailure",
    "UserPromptSubmit", "Stop", "SubagentStop",
    "PreCompact", "Notification", "SubagentStart", "PermissionRequest",
}


def _make_command_hook(command: str):
    """Create an async hook function that executes a shell command.

    The hook receives (hook_input, session_id, hook_context) and returns
    a SyncHookJSONOutput dict. Shell command stdout is parsed as JSON
    if possible, otherwise an empty dict is returned.
    """
    async def hook_fn(hook_input, session_id, hook_context):
        if not shutil.which("entire"):
            logger.debug("Entire CLI not on PATH — skipping hook command")
            return {}

        try:
            # Serialize the hook input as JSON for the command's stdin
            input_json = json.dumps(dict(hook_input)) if hook_input else ""

            result = await asyncio.to_thread(
                subprocess.run,
                command,
                shell=True,
                input=input_json,
                capture_output=True,
                text=True,
                timeout=15,
            )

            if result.returncode != 0:
                logger.debug(
                    f"Hook command exited {result.returncode}: {result.stderr.strip()}"
                )
                return {}

            # Try to parse stdout as JSON (some hooks return systemMessage etc.)
            stdout = result.stdout.strip()
            if stdout:
                try:
                    return json.loads(stdout)
                except json.JSONDecodeError:
                    pass

            return {}
        except (subprocess.TimeoutExpired, OSError) as e:
            logger.debug(f"Hook command failed: {e}")
            return {}

    return hook_fn


def load_hooks() -> dict[str, list[HookMatcher]]:
    """Load entire_hooks.json and return SDK-compatible hooks dict.

    Returns a dict mapping SDK hook event names to lists of HookMatcher
    objects, ready to pass to ClaudeAgentOptions(hooks=...).

    Hook events that don't map to SDK events (SessionStart, SessionEnd)
    are skipped — those are handled by the CLI's settings.json, not the SDK.
    """
    try:
        data = json.loads(_HOOKS_FILE.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        logger.warning("Could not load entire_hooks.json — no hooks registered")
        return {}

    hooks_config = data.get("hooks", {})
    sdk_hooks = {}

    for event_name, matchers in hooks_config.items():
        # Only include events the SDK supports
        if event_name not in _SDK_HOOK_EVENTS:
            logger.debug(f"Skipping non-SDK hook event: {event_name}")
            continue

        hook_matchers = []
        for matcher_def in matchers:
            matcher_str = matcher_def.get("matcher", "") or None
            command_hooks = []

            for hook_def in matcher_def.get("hooks", []):
                if hook_def.get("type") == "command":
                    command = hook_def["command"]
                    command_hooks.append(_make_command_hook(command))

            if command_hooks:
                hook_matchers.append(
                    HookMatcher(matcher=matcher_str, hooks=command_hooks)
                )

        if hook_matchers:
            sdk_hooks[event_name] = hook_matchers
            logger.debug(
                f"Registered {len(hook_matchers)} matcher(s) for {event_name}"
            )

    logger.info(f"Loaded hooks for {len(sdk_hooks)} event(s): {list(sdk_hooks.keys())}")
    return sdk_hooks
