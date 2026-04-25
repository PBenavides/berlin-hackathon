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
import json
import logging
import os
import subprocess
import sys
from pathlib import Path

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

    # Check git is clean (warn, don't block)
    result = subprocess.run(
        ["git", "status", "--porcelain"],
        cwd=str(config.project_root),
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


def _load_resume_state() -> tuple[dict, dict, int] | None:
    """Load state.json and determine resume point.

    Returns:
        (spec, state, start_sprint) or None if no resumable run.
    """
    state_path = config.artifacts_dir / "state.json"
    if not state_path.exists():
        print("ERROR: No state.json found — nothing to resume.")
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
        "--verbose", "-v",
        action="store_true",
        help="Enable debug logging",
    )
    return parser.parse_args()


async def main() -> None:
    args = parse_args()
    setup_logging(args.verbose)

    if not preflight_checks(use_api_key=args.api_key):
        sys.exit(1)

    # ── Pin to current branch ────────────────────────────────────
    target_branch = _detect_target_branch()
    if not target_branch:
        print("ERROR: Could not determine current git branch (detached HEAD?).")
        print("  Check out a branch, or set AI_BUILDER_TARGET_BRANCH.")
        sys.exit(1)
    config.main_branch = target_branch
    print(f"  Target branch: {target_branch} (sprints will merge here)")

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
