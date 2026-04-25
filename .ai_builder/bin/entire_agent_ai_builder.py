#!/usr/bin/env python3
"""Entire external agent plugin for AI Builder.

Implements the Entire CLI external agent protocol (v1).
Tracks AI Builder orchestration sessions — build runs, sprints, verdicts —
as a layer above the per-agent-call Claude Code sessions.

Reference: https://docs.entire.io/cli/external-agents#conventions
"""

import base64
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

PROTOCOL_VERSION = 1
AGENT_NAME = "ai-builder"
AGENT_TYPE = "AI Builder"
DESCRIPTION = "Autonomous multi-agent development harness (Planner → Generator → Evaluator)"
PROTECTED_DIRS = [".ai_builder/artifacts"]
HOOK_NAMES = ["session-start", "session-end", "user-prompt-submit", "stop"]


# ── Helpers ───────────────────────────────────────────────────────────────

def _repo_root() -> Path:
    return Path(os.environ.get("ENTIRE_REPO_ROOT", os.getcwd()))


def _ai_builder_root() -> Path:
    return _repo_root() / ".ai_builder"


def _artifacts_dir() -> Path:
    return _ai_builder_root() / "artifacts"


def _events_path() -> Path:
    return _artifacts_dir() / "events.jsonl"


def _hooks_marker() -> Path:
    return _ai_builder_root() / ".entire_hooks_installed"


def _out(data):
    """Write JSON to stdout and exit 0."""
    json.dump(data, sys.stdout)
    sys.stdout.write("\n")
    sys.stdout.flush()


def _err(msg: str):
    """Write error to stderr and exit 1."""
    sys.stderr.write(f"entire-agent-ai-builder: {msg}\n")
    sys.exit(1)


def _read_stdin_json() -> dict:
    """Read JSON from stdin."""
    raw = sys.stdin.read()
    if not raw.strip():
        return {}
    return json.loads(raw)


def _get_flag(name: str) -> str | None:
    """Extract a --flag value from sys.argv."""
    args = sys.argv
    for i, arg in enumerate(args):
        if arg == name and i + 1 < len(args):
            return args[i + 1]
    return None


def _load_state() -> dict:
    """Load state.json, return empty dict if missing."""
    state_path = _artifacts_dir() / "state.json"
    if state_path.exists():
        try:
            return json.loads(state_path.read_text())
        except (json.JSONDecodeError, OSError):
            pass
    return {}


def _current_run_id() -> str:
    """Get the current run_id from state.json or generate a fallback."""
    state = _load_state()
    return state.get("run_id", datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S"))


def _git_modified_files() -> list[str]:
    """Get files modified on the current branch vs main."""
    try:
        result = subprocess.run(
            ["git", "diff", "--name-only", "main...HEAD"],
            capture_output=True, text=True, cwd=str(_repo_root()),
            timeout=10,
        )
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip().split("\n")
    except (subprocess.TimeoutExpired, FileNotFoundError):
        pass
    return []


# ── Required Subcommands ─────────────────────────────────────────────────

def cmd_info():
    _out({
        "protocol_version": PROTOCOL_VERSION,
        "name": AGENT_NAME,
        "type": AGENT_TYPE,
        "description": DESCRIPTION,
        "is_preview": True,
        "protected_dirs": PROTECTED_DIRS,
        "hook_names": HOOK_NAMES,
        "capabilities": {
            "hooks": True,
            "transcript_analyzer": True,
            "transcript_preparer": False,
            "token_calculator": False,
            "text_generator": False,
            "hook_response_writer": True,
            "subagent_aware_extractor": False,
        },
    })


def cmd_detect():
    present = (_ai_builder_root() / "run.py").exists()
    _out({"present": present})


def cmd_get_session_id():
    hook_input = _read_stdin_json()
    sid = hook_input.get("session_id")
    if not sid:
        sid = _current_run_id()
    _out({"session_id": f"ai-builder-{sid}"})


def cmd_get_session_dir():
    repo_path = _get_flag("--repo-path")
    if not repo_path:
        repo_path = str(_repo_root())
    session_dir = str(Path(repo_path) / ".ai_builder" / "artifacts")
    _out({"session_dir": session_dir})


def cmd_resolve_session_file():
    session_dir = _get_flag("--session-dir")
    session_id = _get_flag("--session-id")
    if not session_dir:
        _err("--session-dir is required")
    # The canonical session file is always state.json
    _out({"session_file": str(Path(session_dir) / "state.json")})


def cmd_read_session():
    hook_input = _read_stdin_json()
    state = _load_state()
    repo = str(_repo_root())
    run_id = state.get("run_id", "unknown")

    modified = _git_modified_files()

    session = {
        "session_id": f"ai-builder-{run_id}",
        "agent_name": AGENT_NAME,
        "repo_path": repo,
        "session_ref": str(_events_path()),
        "start_time": state.get("created_at", datetime.now(timezone.utc).isoformat()),
        "native_data": json.dumps(state).encode().decode("utf-8") if state else None,
        "modified_files": modified,
        "new_files": [],
        "deleted_files": [],
    }
    _out(session)


def cmd_write_session():
    session = _read_stdin_json()
    native = session.get("native_data")
    if native:
        # Restore state from native_data
        try:
            state_data = json.loads(native) if isinstance(native, str) else native
            state_path = _artifacts_dir() / "state.json"
            state_path.parent.mkdir(parents=True, exist_ok=True)
            state_path.write_text(json.dumps(state_data, indent=2, default=str))
        except (json.JSONDecodeError, OSError, TypeError):
            pass
    # exit 0 on success (default)


def cmd_read_transcript():
    session_ref = _get_flag("--session-ref")
    if not session_ref:
        session_ref = str(_events_path())
    path = Path(session_ref)
    if path.exists():
        sys.stdout.buffer.write(path.read_bytes())
    # Empty output if file doesn't exist


def cmd_chunk_transcript():
    max_size = int(_get_flag("--max-size") or 1048576)  # 1MB default
    data = sys.stdin.buffer.read()
    chunks = []
    # Split on line boundaries
    lines = data.split(b"\n")
    current_chunk = b""
    for line in lines:
        candidate = current_chunk + line + b"\n"
        if len(candidate) > max_size and current_chunk:
            chunks.append(base64.b64encode(current_chunk).decode())
            current_chunk = line + b"\n"
        else:
            current_chunk = candidate
    if current_chunk:
        chunks.append(base64.b64encode(current_chunk).decode())
    _out({"chunks": chunks})


def cmd_reassemble_transcript():
    obj = _read_stdin_json()
    for chunk in obj.get("chunks", []):
        sys.stdout.buffer.write(base64.b64decode(chunk))


def cmd_format_resume_command():
    session_id = _get_flag("--session-id")
    # Strip the "ai-builder-" prefix to get the run_id
    run_id = session_id
    if run_id and run_id.startswith("ai-builder-"):
        run_id = run_id[len("ai-builder-"):]
    _out({
        "command": f"cd .ai_builder && python run.py --spec artifacts/specs/spec-{run_id}.json",
    })


# ── Hooks Capability ─────────────────────────────────────────────────────

def cmd_parse_hook():
    hook_name = _get_flag("--hook")
    hook_input = _read_stdin_json()

    event_map = {
        "session-start": 1,   # SessionStart
        "user-prompt-submit": 2,  # TurnStart
        "stop": 3,            # TurnEnd
        "session-end": 5,     # SessionEnd
    }

    event_type = event_map.get(hook_name)
    if event_type is None:
        # Unknown hook — return null (graceful no-op)
        print("null")
        return

    event = {
        "type": event_type,
        "session_id": hook_input.get("session_id", ""),
        "session_ref": hook_input.get("session_ref"),
        "prompt": hook_input.get("user_prompt"),
        "timestamp": hook_input.get("timestamp"),
        "metadata": hook_input.get("raw_data"),
    }
    _out(event)


def cmd_install_hooks():
    local_dev = "--local-dev" in sys.argv
    marker = _hooks_marker()
    marker.parent.mkdir(parents=True, exist_ok=True)
    marker.write_text(json.dumps({
        "installed_at": datetime.now(timezone.utc).isoformat(),
        "local_dev": local_dev,
        "hooks": HOOK_NAMES,
    }))
    _out({"hooks_installed": len(HOOK_NAMES)})


def cmd_uninstall_hooks():
    marker = _hooks_marker()
    if marker.exists():
        marker.unlink()
    # exit 0


def cmd_are_hooks_installed():
    _out({"installed": _hooks_marker().exists()})


# ── Transcript Analyzer Capability ───────────────────────────────────────

def cmd_get_transcript_position():
    path_arg = _get_flag("--path")
    if path_arg:
        p = Path(path_arg)
    else:
        p = _events_path()
    position = p.stat().st_size if p.exists() else 0
    _out({"position": position})


def cmd_extract_modified_files():
    offset = int(_get_flag("--offset") or 0)
    files = _git_modified_files()
    # Also parse events.jsonl for file references from offset
    events_file = _events_path()
    if events_file.exists():
        try:
            content = events_file.read_bytes()
            relevant = content[offset:]
            for line in relevant.decode("utf-8", errors="replace").splitlines():
                try:
                    entry = json.loads(line)
                    data = entry.get("data", {})
                    for f in data.get("modified_files", []):
                        if f not in files:
                            files.append(f)
                except json.JSONDecodeError:
                    continue
        except OSError:
            pass
    _out({"files": files, "current_position": events_file.stat().st_size if events_file.exists() else 0})


def cmd_extract_prompts():
    session_ref = _get_flag("--session-ref")
    offset = int(_get_flag("--offset") or 0)

    prompts = []
    path = Path(session_ref) if session_ref else _events_path()
    if path.exists():
        try:
            content = path.read_bytes()
            relevant = content[offset:]
            for line in relevant.decode("utf-8", errors="replace").splitlines():
                try:
                    entry = json.loads(line)
                    data = entry.get("data", {})
                    prompt = data.get("user_prompt") or data.get("prompt")
                    if prompt:
                        prompts.append(prompt)
                except json.JSONDecodeError:
                    continue
        except OSError:
            pass
    _out({"prompts": prompts})


def cmd_extract_summary():
    state = _load_state()
    if not state:
        _out({"summary": "", "has_summary": False})
        return

    run_id = state.get("run_id", "unknown")
    status = state.get("status", "unknown")
    duration = state.get("total_duration_s", 0)
    current_sprint = state.get("current_sprint", 0)
    history = state.get("history", [])

    # Count sprints passed/failed from history
    passed = sum(1 for h in history if h.get("stage") == "merged")
    failed = sum(1 for h in history if h.get("verdict") == "fail")

    parts = [f"AI Builder run {run_id}: {status}"]
    if duration:
        parts.append(f"Duration: {duration / 60:.1f}min")
    if current_sprint:
        parts.append(f"Sprints: {current_sprint} (passed: {passed}, failed: {failed})")

    summary = ". ".join(parts) + "."
    _out({"summary": summary, "has_summary": True})


# ── Hook Response Writer Capability ──────────────────────────────────────

def cmd_write_hook_response():
    msg = _get_flag("--message")
    if not msg:
        msg = ""
    _out({"systemMessage": msg})


# ── Dispatch ─────────────────────────────────────────────────────────────

COMMANDS = {
    # Required
    "info": cmd_info,
    "detect": cmd_detect,
    "get-session-id": cmd_get_session_id,
    "get-session-dir": cmd_get_session_dir,
    "resolve-session-file": cmd_resolve_session_file,
    "read-session": cmd_read_session,
    "write-session": cmd_write_session,
    "read-transcript": cmd_read_transcript,
    "chunk-transcript": cmd_chunk_transcript,
    "reassemble-transcript": cmd_reassemble_transcript,
    "format-resume-command": cmd_format_resume_command,
    # Hooks capability
    "parse-hook": cmd_parse_hook,
    "install-hooks": cmd_install_hooks,
    "uninstall-hooks": cmd_uninstall_hooks,
    "are-hooks-installed": cmd_are_hooks_installed,
    # Transcript analyzer capability
    "get-transcript-position": cmd_get_transcript_position,
    "extract-modified-files": cmd_extract_modified_files,
    "extract-prompts": cmd_extract_prompts,
    "extract-summary": cmd_extract_summary,
    # Hook response writer capability
    "write-hook-response": cmd_write_hook_response,
}


def main():
    if len(sys.argv) < 2:
        _err(f"Usage: entire-agent-ai-builder <subcommand>\nSubcommands: {', '.join(COMMANDS)}")

    subcommand = sys.argv[1]
    handler = COMMANDS.get(subcommand)
    if handler is None:
        _err(f"Unknown subcommand: {subcommand}")

    try:
        handler()
    except BrokenPipeError:
        # Entire CLI closed stdout early — not an error
        pass
    except Exception as e:
        _err(f"{subcommand} failed: {e}")


if __name__ == "__main__":
    main()
