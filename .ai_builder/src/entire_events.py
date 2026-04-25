"""Event emitter for Entire external agent integration.

Two responsibilities:
1. Appends JSONL events to artifacts/events.jsonl (transcript for the plugin)
2. Calls `entire attach` at session end so Entire tracks the build session
"""

import json
import logging
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from config import config

logger = logging.getLogger("ai_builder.entire")

_EVENTS_FILE = "events.jsonl"


def _events_path() -> Path:
    return config.artifacts_dir / _EVENTS_FILE


def _emit(event_type: str, run_id: str, **data):
    """Append a single JSONL event line to the transcript."""
    path = _events_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    event = {
        "type": event_type,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "session_id": f"ai-builder-{run_id}",
        "data": data,
    }
    with open(path, "a") as f:
        f.write(json.dumps(event, default=str) + "\n")
    logger.debug(f"Entire event: {event_type} (run={run_id})")


def _attach_session(run_id: str):
    """Call `entire attach` to register the build session with Entire.

    Fails silently if the Entire CLI is not installed or not enabled.
    """
    if not shutil.which("entire"):
        logger.debug("Entire CLI not on PATH — skipping attach")
        return

    session_id = f"ai-builder-{run_id}"
    try:
        result = subprocess.run(
            ["entire", "attach", "--agent", "ai-builder", "--force", session_id],
            capture_output=True, text=True,
            cwd=str(config.project_root),
            timeout=15,
        )
        if result.returncode == 0:
            logger.info(f"Entire session attached: {session_id}")
            if result.stdout.strip():
                logger.info(result.stdout.strip())
        else:
            logger.debug(f"Entire attach failed: {result.stderr.strip()}")
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError) as e:
        logger.debug(f"Entire attach failed: {e}")


def emit_session_start(run_id: str, user_prompt: str):
    _emit("session_start", run_id, user_prompt=user_prompt)


def emit_sprint_start(run_id: str, sprint_number: int, sprint_name: str):
    _emit("sprint_start", run_id, sprint_number=sprint_number, sprint_name=sprint_name)


def emit_generation_complete(
    run_id: str, sprint_number: int, session_id: str | None, cost_usd: float,
):
    _emit(
        "generation_complete", run_id,
        sprint_number=sprint_number, session_id=session_id, cost_usd=cost_usd,
    )


def emit_sprint_end(run_id: str, sprint_number: int, verdict: str, score: float):
    _emit(
        "sprint_end", run_id,
        sprint_number=sprint_number, verdict=verdict, score=score,
    )


def emit_session_end(run_id: str, status: str, total_duration_s: float):
    _emit("session_end", run_id, status=status, total_duration_s=total_duration_s)
    _attach_session(run_id)
