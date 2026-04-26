#!/usr/bin/env python3
"""CLI entry point for the AI Builder harness.

Usage:
    python run.py "Add social features with friend challenges"
    python run.py --dry-run "Add a simple about page"
    python run.py --resume                          # resume last run from where it stopped
    python run.py --spec artifacts/specs/spec-20260405.json
    python run.py --sprint 2 --spec artifacts/specs/spec-20260405.json
"""

import argparse
import asyncio
import atexit
import json
import logging
import os
import signal
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

# Ensure .ai_builder is on sys.path for imports
sys.path.insert(0, str(Path(__file__).resolve().parent))

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent / ".env")
except ImportError:
    pass  # dotenv optional — API key can come from environment or CLI auth

from config import config


def setup_logging(verbose: bool = False) -> None:
    """Configure logging for the builder."""
    level = logging.DEBUG if verbose else logging.INFO
    formatter = logging.Formatter(
        "[%(asctime)s] %(name)s %(levelname)s: %(message)s",
        datefmt="%H:%M:%S",
    )
    handler = logging.StreamHandler()
    handler.setFormatter(formatter)

    root = logging.getLogger("ai_builder")
    root.setLevel(level)
    root.addHandler(handler)


def preflight_checks(use_api_key: bool = False) -> bool:
    """Validate environment before running."""
    ok = True

    # Check auth: prefer CLI subscription unless --api-key is passed
    has_api_key = bool(os.environ.get("ANTHROPIC_API_KEY"))
    cli_result = subprocess.run(
        ["claude", "--version"],
        capture_output=True,
        text=True,
    )
    has_cli = cli_result.returncode == 0

    if use_api_key and has_api_key:
        print("  Auth: ANTHROPIC_API_KEY (explicit)")
    elif has_cli:
        # Clear API key so SDK uses CLI subscription auth (Max Plan)
        if has_api_key:
            os.environ.pop("ANTHROPIC_API_KEY", None)
            print(f"  Auth: Claude CLI subscription ({cli_result.stdout.strip()})")
            print("  (Cleared ANTHROPIC_API_KEY from env — using Max Plan)")
        else:
            print(f"  Auth: Claude CLI subscription ({cli_result.stdout.strip()})")
    elif has_api_key:
        print("  Auth: ANTHROPIC_API_KEY (fallback — no CLI found)")
    else:
        print("ERROR: No authentication found.")
        print("  Option 1: Install Claude CLI and run 'claude login'")
        print("  Option 2: Set ANTHROPIC_API_KEY in .env or environment")
        ok = False

    # Check SDK installed
    try:
        import claude_agent_sdk  # noqa: F401
    except ImportError:
        print("ERROR: claude-agent-sdk not installed.")
        print("  Run: pip install claude-agent-sdk")
        ok = False

    # Check git is clean (warn, don't block). Use work_dir so that in
    # worktree mode this reflects the worktree's state, not the monorepo.
    result = subprocess.run(
        ["git", "status", "--porcelain"],
        cwd=str(config.work_dir),
        capture_output=True,
        text=True,
    )
    if result.stdout.strip():
        print("WARNING: Git working tree has uncommitted changes.")
        print("  Consider committing or stashing before running the builder.")
        print()

    # Check npx/playwright available (for evaluator)
    result = subprocess.run(
        ["npx", "--version"],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print("WARNING: npx not found. Evaluator needs it for Playwright MCP.")
        print("  Install Node.js: https://nodejs.org/")
        print()

    return ok


def _pid_alive(pid: int) -> bool:
    """Best-effort check if a process is still running."""
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        # Process exists but is owned by another user — treat as alive.
        return True
    except OSError:
        return False
    return True


def _acquire_instance_lock() -> Path:
    """Refuse to start if another ai-build is running for this instance.

    The lock file lives at <instance_dir>/.lock and stores the holding
    process's PID. A stale lock (PID dead) is silently overwritten.
    """
    instance_dir = config.instance_dir
    instance_dir.mkdir(parents=True, exist_ok=True)
    lock_path = instance_dir / ".lock"

    if lock_path.exists():
        try:
            data = json.loads(lock_path.read_text())
            holder_pid = int(data.get("pid", 0))
            holder_started = data.get("started_at", "?")
        except (json.JSONDecodeError, ValueError, OSError):
            holder_pid, holder_started = 0, "?"

        if holder_pid and holder_pid != os.getpid() and _pid_alive(holder_pid):
            print(
                f"ERROR: another ai-build is already running for instance "
                f"'{config.instance}' (pid {holder_pid}, started {holder_started})."
            )
            print(f"  Lock file: {lock_path}")
            print(
                "  Wait for it to finish, or set AI_BUILDER_INSTANCE to a different "
                "name to run a separate instance."
            )
            sys.exit(1)
        # Stale lock — fall through and overwrite.

    lock_path.write_text(
        json.dumps(
            {
                "pid": os.getpid(),
                "instance": config.instance,
                "started_at": datetime.now().isoformat(),
            },
            indent=2,
        )
    )

    def _release():
        try:
            if lock_path.exists():
                data = json.loads(lock_path.read_text())
                if int(data.get("pid", 0)) == os.getpid():
                    lock_path.unlink()
        except (OSError, json.JSONDecodeError, ValueError):
            pass

    atexit.register(_release)

    # Best-effort signal cleanup so Ctrl-C doesn't leave a stale lock.
    def _signal_release(signum, frame):
        _release()
        # Re-raise default behavior.
        signal.signal(signum, signal.SIG_DFL)
        os.kill(os.getpid(), signum)

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            signal.signal(sig, _signal_release)
        except (ValueError, OSError):
            pass

    return lock_path


def _stamp_lock_with_run_context(target_branch: str, work_dir: Path) -> None:
    """Add target_branch + work_dir to the lock file for diagnostics.

    Best-effort: only updates the lock if it's still ours.
    """
    lock_path = config.instance_dir / ".lock"
    try:
        if not lock_path.exists():
            return
        data = json.loads(lock_path.read_text())
        if int(data.get("pid", 0)) != os.getpid():
            return
        data["target_branch"] = target_branch
        data["work_dir"] = str(work_dir)
        lock_path.write_text(json.dumps(data, indent=2))
    except (OSError, json.JSONDecodeError, ValueError):
        pass


def _detect_target_branch() -> str | None:
    """Detect the branch the builder should attach to.

    Precedence: AI_BUILDER_TARGET_BRANCH env var, then `git branch --show-current`.
    Returns None on detached HEAD or git failure.
    """
    override = os.environ.get("AI_BUILDER_TARGET_BRANCH")
    if override:
        return override.strip()

    result = subprocess.run(
        ["git", "branch", "--show-current"],
        cwd=str(config.project_root),
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        return None
    branch = result.stdout.strip()
    return branch or None


# ── Worktree helpers ──────────────────────────────────────────────────────


def _branch_short_name(refname: str) -> str:
    """Strip refs/heads/ prefix from a branch ref."""
    if refname.startswith("refs/heads/"):
        return refname[len("refs/heads/"):]
    return refname


def _list_worktrees() -> list[dict[str, Any]]:
    """Parse `git worktree list --porcelain` from the monorepo."""
    result = subprocess.run(
        ["git", "worktree", "list", "--porcelain"],
        cwd=str(config.project_root),
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        return []
    entries: list[dict[str, Any]] = []
    current: dict[str, Any] = {}
    for line in result.stdout.splitlines():
        if not line.strip():
            if current:
                entries.append(current)
                current = {}
            continue
        if line.startswith("worktree "):
            current["path"] = line[len("worktree "):]
        elif line.startswith("HEAD "):
            current["head"] = line[len("HEAD "):]
        elif line.startswith("branch "):
            current["branch"] = _branch_short_name(line[len("branch "):])
        elif line == "detached":
            current["detached"] = True
        elif line == "bare":
            current["bare"] = True
    if current:
        entries.append(current)
    return entries


def _branch_exists(branch: str) -> bool:
    result = subprocess.run(
        ["git", "show-ref", "--verify", "--quiet", f"refs/heads/{branch}"],
        cwd=str(config.project_root),
    )
    return result.returncode == 0


def _worktree_mode_enabled(args: argparse.Namespace) -> bool:
    """True if the user opted in to worktree mode via flag or env var."""
    if getattr(args, "worktree", False):
        return True
    return os.environ.get("AI_BUILDER_USE_WORKTREE") == "1"


def _resolve_target_branch(args: argparse.Namespace, worktree_mode: bool) -> str:
    """Resolve the branch the run should target / pin its worktree to.

    Precedence:
    1. --branch CLI arg
    2. AI_BUILDER_TARGET_BRANCH env var
    3. Worktree mode default: ai-builder/<instance>
    4. Otherwise: current branch (legacy `_detect_target_branch`)
    """
    if getattr(args, "branch", None):
        return args.branch.strip()

    env_branch = os.environ.get("AI_BUILDER_TARGET_BRANCH")
    if env_branch:
        return env_branch.strip()

    if worktree_mode:
        return f"ai-builder/{config.instance}"

    detected = _detect_target_branch()
    if not detected:
        print("ERROR: Could not determine current git branch (detached HEAD?).")
        print("  Check out a branch, or set AI_BUILDER_TARGET_BRANCH.")
        sys.exit(1)
    return detected


def _ensure_worktree(instance: str, target_branch: str) -> Path:
    """Create or validate the worktree for this instance.

    Returns the worktree path on success; aborts on irrecoverable errors.
    """
    worktree_path = config.worktrees_root / instance
    worktrees = _list_worktrees()

    existing = None
    for w in worktrees:
        try:
            if Path(w["path"]).resolve() == worktree_path.resolve():
                existing = w
                break
        except (OSError, KeyError):
            continue

    branch_holder = None
    for w in worktrees:
        if existing and w is existing:
            continue
        if w.get("branch") == target_branch:
            branch_holder = w
            break

    if existing:
        if not worktree_path.exists():
            print(f"  Pruning stale worktree entry for {worktree_path}")
            subprocess.run(
                ["git", "worktree", "prune"],
                cwd=str(config.project_root),
                check=False,
            )
            existing = None
        elif existing.get("branch") != target_branch:
            print(
                f"ERROR: worktree at {worktree_path} is on branch "
                f"'{existing.get('branch', '(detached)')}', expected '{target_branch}'."
            )
            print(f"  Remove with:  ai-build worktree remove {instance}")
            print(f"  Then re-run.")
            sys.exit(1)
        else:
            return worktree_path

    if branch_holder:
        print(
            f"ERROR: branch '{target_branch}' is already checked out at "
            f"{branch_holder['path']}."
        )
        print(
            "  Use --branch <other> or AI_BUILDER_TARGET_BRANCH=<other>, "
            "or remove the conflicting worktree."
        )
        sys.exit(1)

    config.worktrees_root.mkdir(parents=True, exist_ok=True)

    if _branch_exists(target_branch):
        print(f"  Creating worktree for branch '{target_branch}' at {worktree_path}")
        cmd = ["git", "worktree", "add", str(worktree_path), target_branch]
    else:
        print(
            f"  Creating new branch '{target_branch}' and worktree at {worktree_path}"
        )
        cmd = ["git", "worktree", "add", "-b", target_branch, str(worktree_path), "HEAD"]

    result = subprocess.run(
        cmd,
        cwd=str(config.project_root),
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print("ERROR: git worktree add failed:")
        if result.stderr.strip():
            for line in result.stderr.strip().splitlines():
                print(f"  {line}")
        sys.exit(1)
    return worktree_path


def _handle_worktree_command(argv: list[str]) -> int:
    """Dispatch `ai-build worktree {list|remove|prune}`.

    Returns the process exit code.
    """
    usage = "Usage: ai-build worktree {list | remove <instance> | prune}"
    if not argv:
        print(usage)
        return 1
    cmd = argv[0]

    if cmd in ("-h", "--help", "help"):
        print(usage)
        return 0

    if cmd == "list":
        worktrees = _list_worktrees()
        if not worktrees:
            print("No worktrees registered.")
            return 0
        print(f"{'PATH':<70} {'BRANCH':<40}")
        for w in worktrees:
            branch = w.get("branch") or "(detached)"
            print(f"{w.get('path', '?'):<70} {branch:<40}")
        return 0

    if cmd == "remove":
        if len(argv) < 2:
            print(usage)
            return 1
        instance = argv[1]
        wt_path = config.worktrees_root / instance
        result = subprocess.run(
            ["git", "worktree", "remove", str(wt_path)],
            cwd=str(config.project_root),
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            stderr = result.stderr.strip()
            print(f"ERROR: {stderr or 'failed to remove worktree'}")
            return 1
        print(f"Removed worktree at {wt_path}")
        return 0

    if cmd == "prune":
        result = subprocess.run(
            ["git", "worktree", "prune", "-v"],
            cwd=str(config.project_root),
            capture_output=True,
            text=True,
        )
        out = result.stdout.rstrip()
        print(out if out else "Nothing to prune.")
        return result.returncode

    print(f"Unknown worktree subcommand: {cmd}")
    print(usage)
    return 1


def _load_resume_state() -> tuple[dict, dict, int] | None:
    """Load state.json and determine resume point.

    Returns:
        (spec, state, start_sprint) or None if no resumable run.
    """
    state_path = config.instance_dir / "state.json"
    if not state_path.exists():
        print(f"ERROR: No state.json found for instance '{config.instance}' — nothing to resume.")
        print(f"  Expected: {state_path}")
        return None

    state = json.loads(state_path.read_text())
    run_id = state.get("run_id")
    status = state.get("status")

    # Find the spec for this run, or fall back to latest available spec
    spec_path = config.artifacts_dir / "specs" / f"spec-{run_id}.json"
    if not spec_path.exists():
        # State might point to a failed retry — find the latest spec
        specs_dir = config.artifacts_dir / "specs"
        available = sorted(specs_dir.glob("spec-*.json"))
        if not available:
            print(f"ERROR: No spec files found in {specs_dir}")
            return None
        spec_path = available[-1]
        print(f"  Note: spec for run {run_id} not found, using latest: {spec_path.name}")

    spec = json.loads(spec_path.read_text())
    current_sprint = state.get("current_sprint", 1)

    # Determine where to resume
    terminal_states = {"complete", "dry_run_complete"}
    if status in terminal_states:
        print(f"Run {run_id} already completed (status: {status}). Nothing to resume.")
        return None

    print(f"  Resuming run: {run_id}")
    print(f"  Last status:  {status}")
    print(f"  Sprint:       {current_sprint}")
    print()

    # The Claude session from the previous process is gone, so we can't
    # resume mid-stage (e.g. mid-self-fix). We restart from the beginning
    # of the current sprint. The generator will see the existing branch
    # and code if it already committed.
    return spec, state, current_sprint


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="AI Builder: autonomous feature development",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python run.py "Add a public leaderboard"
  python run.py --dry-run "Add friend challenges"
  python run.py --resume
  python run.py --spec artifacts/specs/spec-20260405-143022.json
  python run.py --sprint 2 --spec artifacts/specs/spec-20260405-143022.json
        """,
    )
    parser.add_argument(
        "prompt",
        nargs="?",
        help="Feature request prompt (1-4 sentences)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Only run planner, don't generate code",
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Resume the last interrupted run from its current sprint",
    )
    parser.add_argument(
        "--spec",
        type=str,
        help="Path to existing spec JSON (skip planning)",
    )
    parser.add_argument(
        "--sprint",
        type=int,
        default=None,
        help="Sprint number to start from",
    )
    parser.add_argument(
        "--api-key",
        action="store_true",
        help="Use ANTHROPIC_API_KEY instead of CLI subscription auth",
    )
    parser.add_argument(
        "--skip-evaluator",
        action="store_true",
        help="Skip the Playwright evaluator phase. Each sprint is "
             "auto-merged after self-critic (no QA report).",
    )
    parser.add_argument(
        "--worktree",
        action="store_true",
        help="Run agents inside a per-instance git worktree at "
             ".ai_builder/worktrees/<instance>/. Same as AI_BUILDER_USE_WORKTREE=1.",
    )
    parser.add_argument(
        "--branch",
        type=str,
        default=None,
        help="Target branch the worktree is pinned to (defaults to "
             "ai-builder/<instance> in worktree mode, or current branch otherwise).",
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Enable debug logging",
    )
    return parser.parse_args()


async def main() -> None:
    # ── Worktree management subcommand: dispatch before normal arg parsing ──
    if len(sys.argv) > 1 and sys.argv[1] == "worktree":
        sys.exit(_handle_worktree_command(sys.argv[2:]))

    args = parse_args()
    setup_logging(args.verbose)

    if not preflight_checks(use_api_key=args.api_key):
        sys.exit(1)

    # ── Refuse to run two ai-builds for the same instance ────────
    _acquire_instance_lock()
    print(f"  Instance: {config.instance} (artifacts: {config.instance_dir.relative_to(config.ai_builder_root)})")

    # ── Resolve target branch + (optionally) ensure worktree ──────
    worktree_mode = _worktree_mode_enabled(args)
    target_branch = _resolve_target_branch(args, worktree_mode)

    if worktree_mode:
        worktree_path = _ensure_worktree(config.instance, target_branch)
        config.work_dir = worktree_path
        print(
            f"  Worktree:      {worktree_path.relative_to(config.ai_builder_root)} "
            f"(branch: {target_branch})"
        )
    else:
        # Legacy single-tree mode: agents operate in the monorepo.
        config.work_dir = config.project_root

    config.main_branch = target_branch
    print(
        f"  Target branch: {target_branch} "
        f"(sprints branch off and merge back here)"
    )

    # Re-stamp the lock with worktree info for diagnostics.
    _stamp_lock_with_run_context(target_branch=target_branch, work_dir=config.work_dir)

    # ── Tracing (opt-in) ─────────────────────────────────────────
    if config.tracing_enabled:
        from src.tracing import init_tracing

        ok = init_tracing(
            project_name=config.phoenix_project_name,
            phoenix_endpoint=config.phoenix_endpoint,
            phoenix_api_key=config.phoenix_api_key,
        )
        if ok:
            print(f"  Tracing: Phoenix ({config.phoenix_endpoint or 'localhost:6006'})")
        else:
            print("  Tracing: disabled (packages not installed)")

    spec_override = None
    start_sprint = args.sprint or 1
    prompt = args.prompt

    # ── Resume mode ────────────────────────────────────────────────
    if args.resume:
        result = _load_resume_state()
        if result is None:
            sys.exit(1)
        spec_override, prev_state, start_sprint = result
        # Allow --sprint to override the auto-detected sprint
        if args.sprint is not None:
            start_sprint = args.sprint
        prompt = spec_override.get("user_prompt", "Resumed run")

    # ── Spec override mode ─────────────────────────────────────────
    elif args.spec:
        spec_path = Path(args.spec)
        if not spec_path.is_absolute():
            spec_path = config.ai_builder_root / spec_path
        if not spec_path.exists():
            print(f"ERROR: Spec file not found: {spec_path}")
            sys.exit(1)
        spec_override = json.loads(spec_path.read_text())
        prompt = prompt or spec_override.get("user_prompt", "From spec")
        print(f"Loaded spec: {spec_path.name}")

    # ── New run mode ───────────────────────────────────────────────
    elif not prompt:
        print("ERROR: Provide a prompt, --spec, or --resume.")
        print()
        print("  New run:   python run.py \"Add a leaderboard feature\"")
        print("  Resume:    python run.py --resume")
        print("  From spec: python run.py --spec artifacts/specs/spec-XXX.json")
        sys.exit(1)

    print()
    print("=" * 60)
    print(f"  AI Builder — {config.project_name}")
    print("=" * 60)
    print(f"  Prompt: {prompt}")
    if args.resume:
        print(f"  Mode:   Resume from sprint {start_sprint}")
    elif args.dry_run:
        print(f"  Mode:   Dry run (plan only)")
    elif args.skip_evaluator:
        print(f"  Mode:   Build (evaluator SKIPPED — sprints auto-merge)")
    else:
        print(f"  Mode:   Full build")
    if start_sprint > 1:
        print(f"  Start:  Sprint {start_sprint}")
    print("=" * 60)
    print()

    from src.agents.orchestrator import run_build_loop

    exit_code = 0
    try:
        state = await run_build_loop(
            user_prompt=prompt,
            dry_run=args.dry_run,
            start_sprint=start_sprint,
            spec_override=spec_override,
            skip_evaluator=args.skip_evaluator,
        )
    except KeyboardInterrupt:
        # Let the user's Ctrl-C bubble up cleanly.
        print("\n  Interrupted. Resume with: python run.py --resume")
        raise
    except Exception as e:
        # Last-resort safety net. Layer 2 should already have caught
        # per-sprint failures, but if anything escapes — orchestrator
        # bug, OOM, etc. — preserve state.json so the run is resumable.
        logger = logging.getLogger("ai_builder")
        logger.exception(f"Build loop crashed: {e}")
        print()
        print("=" * 60)
        print(f"  Build halted with an unexpected error: {e}")
        print("  state.json has been preserved.")
        print("  Resume once fixed:  python run.py --resume")
        print("=" * 60)
        exit_code = 1
    finally:
        if config.tracing_enabled:
            from src.tracing import shutdown_tracing

            shutdown_tracing()

    if exit_code:
        sys.exit(exit_code)


if __name__ == "__main__":
    asyncio.run(main())
