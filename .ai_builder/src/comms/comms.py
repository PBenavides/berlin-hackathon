"""File-based communication protocol for inter-agent artifacts."""

import json
import logging
from datetime import datetime
from pathlib import Path

from config import config

logger = logging.getLogger("ai_builder.comms")


def _ensure_dir(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path


def save_artifact(category: str, filename: str, data: dict) -> Path:
    """Write JSON artifact to artifacts/{category}/{filename}."""
    dir_path = _ensure_dir(config.artifacts_dir / category)
    file_path = dir_path / filename
    file_path.write_text(json.dumps(data, indent=2, default=str))
    logger.info(f"Saved artifact: {file_path}")
    return file_path


def load_artifact(category: str, filename: str) -> dict:
    """Read JSON artifact from artifacts/{category}/{filename}."""
    file_path = config.artifacts_dir / category / filename
    if not file_path.exists():
        raise FileNotFoundError(f"Artifact not found: {file_path}")
    return json.loads(file_path.read_text())


def list_artifacts(category: str, prefix: str = "") -> list[Path]:
    """List artifact files in a category, optionally filtered by prefix."""
    dir_path = config.artifacts_dir / category
    if not dir_path.exists():
        return []
    files = sorted(dir_path.glob(f"{prefix}*.json"))
    return files


def save_state(state: dict) -> Path:
    """Write orchestrator state to artifacts/state.json."""
    state["last_updated"] = datetime.now().isoformat()
    return save_artifact("", "state.json", state)


def load_state() -> dict | None:
    """Load current orchestrator state, or None if no run in progress."""
    state_path = config.artifacts_dir / "state.json"
    if not state_path.exists():
        return None
    return json.loads(state_path.read_text())


def init_state(run_id: str) -> dict:
    """Create initial state for a new run."""
    state = {
        "run_id": run_id,
        "status": "initialized",
        "current_sprint": 0,
        "retry_count": 0,
        "history": [],
        "created_at": datetime.now().isoformat(),
    }
    save_state(state)
    return state


def append_history(state: dict, stage: str, **kwargs) -> dict:
    """Append a history entry to state and save."""
    entry = {
        "stage": stage,
        "timestamp": datetime.now().isoformat(),
        **kwargs,
    }
    state["history"].append(entry)
    save_state(state)
    return state


def load_latest_qa_report(run_id: str, sprint_number: int) -> dict | None:
    """Find the most recent QA report for a given sprint."""
    prefix = f"qa-{run_id}-sprint-{sprint_number}"
    reports = list_artifacts("qa_reports", prefix)
    if not reports:
        return None
    latest = reports[-1]
    return json.loads(latest.read_text())


def load_prompt(name: str) -> str:
    """Load a prompt template from prompts/{name}.md."""
    prompt_path = config.prompts_dir / f"{name}.md"
    if not prompt_path.exists():
        raise FileNotFoundError(f"Prompt not found: {prompt_path}")
    return prompt_path.read_text()
