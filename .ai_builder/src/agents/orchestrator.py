"""Orchestrator: drives the Planner -> Generator -> Evaluator state machine."""

import asyncio
import logging
import subprocess
import time
from datetime import datetime

from config import config
from src.comms import (
    append_history,
    init_state,
    load_latest_qa_report,
    save_artifact,
    save_state,
)
from src.agents.planner import run_planner
from src.agents.generator import run_generator, run_self_critic, run_self_fix
from src.agents.evaluator import run_evaluator
from src.entire_events import (
    emit_session_start, emit_sprint_start, emit_generation_complete,
    emit_sprint_end, emit_session_end,
)
from src.tracing import trace_root, trace_span

logger = logging.getLogger("ai_builder")


def _git(args: list[str], check: bool = True) -> subprocess.CompletedProcess:
    """Run a git command in the project root."""
    return subprocess.run(
        ["git"] + args,
        cwd=str(config.project_root),
        capture_output=True,
        text=True,
        check=check,
    )


def _slugify(name: str) -> str:
    import re
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:40]


def _verify_implementation(sprint: dict) -> bool:
    """Check that the generator actually committed code on the sprint branch.

    Returns True only if:
    1. The sprint branch exists
    2. There are commits on the branch that aren't on main
    """
    slug = _slugify(sprint["name"])
    branch = f"{config.branch_prefix}-{sprint['sprint_number']}-{slug}"

    # Check branch exists
    result = _git(["branch", "--list", branch], check=False)
    if not result.stdout.strip():
        logger.warning(f"Branch {branch} does not exist")
        return False

    # Check for commits ahead of main
    result = _git(
        ["log", f"{config.main_branch}..{branch}", "--oneline"],
        check=False,
    )
    commits = result.stdout.strip()
    if not commits:
        logger.warning(f"Branch {branch} has no commits ahead of {config.main_branch}")
        return False

    commit_count = len(commits.splitlines())
    logger.info(f"Branch {branch}: {commit_count} commit(s) ahead of {config.main_branch}")
    return True


def _merge_sprint_branch(sprint: dict, qa_report: dict) -> None:
    """Merge a sprint branch to main via fast-forward."""
    slug = _slugify(sprint["name"])
    branch = f"{config.branch_prefix}-{sprint['sprint_number']}-{slug}"
    score = qa_report.get("overall_score", 0)
    attempt = qa_report.get("attempt", 1)

    # Switch to main and merge
    _git(["checkout", config.main_branch])
    _git(["merge", "--ff-only", branch])

    # Tag the merge point
    tag = f"ai-sprint-{sprint['sprint_number']}"
    _git(["tag", "-a", tag, "-m",
          f"[ai-builder/merge] Sprint {sprint['sprint_number']}: {sprint['name']}\n"
          f"Score: {score:.1f}/10 | Attempts: {attempt}"],
         check=False)

    # Delete the feature branch
    _git(["branch", "-d", branch], check=False)

    logger.info(f"Merged {branch} -> {config.main_branch} (tag: {tag})")


async def run_build_loop(
    user_prompt: str,
    dry_run: bool = False,
    start_sprint: int = 1,
    spec_override: dict | None = None,
) -> dict:
    """Run the full Planner -> Generator -> Evaluator loop.

    Args:
        user_prompt: User's feature request
        dry_run: If True, only run planner (no generation)
        start_sprint: Sprint number to start from (for resume)
        spec_override: Pre-existing spec to skip planning

    Returns:
        Final state dict with run summary
    """
    # Reuse run_id from spec if resuming, otherwise create new
    if spec_override and spec_override.get("run_id"):
        run_id = spec_override["run_id"]
    else:
        run_id = datetime.now().strftime("%Y%m%d-%H%M%S")
    state = init_state(run_id)
    total_start = time.time()
    emit_session_start(run_id, user_prompt)

    # ── Phase 1: Planning ──────────────────────────────────────────────
    if spec_override:
        spec = spec_override
        logger.info(f"Using provided spec with {len(spec.get('sprints', []))} sprints")
    else:
        state["status"] = "planning"
        save_state(state)

        with trace_root("planning", session_id=f"build-{run_id}", attributes={
            "ai_builder.run_id": run_id,
            "ai_builder.phase": "planning",
        }):
            plan_start = time.time()
            spec = await run_planner(user_prompt, run_id)
            plan_duration = time.time() - plan_start

        save_artifact("specs", f"spec-{run_id}.json", spec)
        append_history(state, "planning", duration_s=round(plan_duration, 1))
        logger.info(f"Planning complete in {plan_duration:.0f}s")

    if dry_run:
        state["status"] = "dry_run_complete"
        save_state(state)
        print("\n=== DRY RUN: Spec generated, no implementation ===")
        print(f"Spec saved to: artifacts/specs/spec-{run_id}.json")
        print(f"Sprints: {len(spec.get('sprints', []))}")
        for s in spec.get("sprints", []):
            print(f"  Sprint {s['sprint_number']}: {s['name']} "
                  f"({len(s.get('features', []))} features)")
        return state

    # ── Phase 2: Sprint Loop ───────────────────────────────────────────
    sprints = spec.get("sprints", [])
    for sprint in sprints:
        if sprint["sprint_number"] < start_sprint:
            logger.info(f"Skipping sprint {sprint['sprint_number']} (before start_sprint)")
            continue

        state["current_sprint"] = sprint["sprint_number"]
        retry_count = 0

        slug = _slugify(sprint["name"])
        print(f"\n{'='*60}")
        print(f"  Sprint {sprint['sprint_number']}: {sprint['name']}")
        print(f"  Features: {len(sprint.get('features', []))}")
        print(f"{'='*60}\n")

        emit_sprint_start(run_id, sprint["sprint_number"], sprint["name"])

        with trace_root(
            f"sprint-{sprint['sprint_number']}-{slug}",
            session_id=f"build-{run_id}",
            attributes={
                "ai_builder.run_id": run_id,
                "ai_builder.sprint": sprint["sprint_number"],
                "ai_builder.sprint_name": sprint["name"],
                "ai_builder.feature_count": len(sprint.get("features", [])),
            },
        ) as sprint_span:
            while retry_count <= config.max_retries:
                with trace_span(f"attempt-{retry_count + 1}", attributes={
                    "ai_builder.attempt": retry_count + 1,
                    "ai_builder.sprint": sprint["sprint_number"],
                }) as attempt_span:

                    # ── Generate ───────────────────────────────────
                    state["status"] = "generating"
                    state["retry_count"] = retry_count
                    save_state(state)

                    bug_report = None
                    if retry_count > 0:
                        bug_report = load_latest_qa_report(
                            run_id, sprint["sprint_number"],
                        )

                    with trace_span("generate", attributes={
                        "ai_builder.step": "generate",
                        "ai_builder.has_bug_report": bug_report is not None,
                    }):
                        gen_start = time.time()
                        contract, session_id = await run_generator(
                            spec, sprint, run_id, bug_report,
                        )
                        gen_duration = time.time() - gen_start

                    save_artifact(
                        "sprint_contracts",
                        f"contract-{run_id}-sprint-{sprint['sprint_number']}.json",
                        contract,
                    )
                    append_history(
                        state, "generating",
                        sprint=sprint["sprint_number"],
                        retry=retry_count,
                        duration_s=round(gen_duration, 1),
                    )
                    emit_generation_complete(
                        run_id, sprint["sprint_number"],
                        session_id, contract.get("cost_usd", 0.0),
                    )

                    # ── Verify implementation happened ─────────────
                    if not _verify_implementation(sprint):
                        logger.error(
                            f"Sprint {sprint['sprint_number']}: generator "
                            f"produced a contract but no code was committed. "
                            f"Skipping self-critic and evaluator."
                        )
                        append_history(
                            state, "generation_empty",
                            sprint=sprint["sprint_number"],
                            retry=retry_count,
                        )
                        if attempt_span:
                            attempt_span.set_attribute(
                                "ai_builder.verdict", "generation_empty",
                            )
                        retry_count += 1
                        if retry_count > config.max_retries:
                            state["status"] = "sprint_failed"
                            save_state(state)
                            _git(["checkout", config.main_branch], check=False)
                            print(
                                f"\n  Sprint {sprint['sprint_number']} FAILED: "
                                f"no implementation produced after "
                                f"{config.max_retries + 1} attempts."
                            )
                            break
                        print(
                            f"\n  No implementation detected — retrying "
                            f"({retry_count}/{config.max_retries})"
                        )
                        continue

                    # ── Self-Critique ──────────────────────────────
                    state["status"] = "self_critiquing"
                    save_state(state)

                    with trace_span("self-critique", attributes={
                        "ai_builder.step": "self_critique",
                    }):
                        critic_start = time.time()
                        review = await run_self_critic(
                            sprint, contract, session_id,
                        )
                        critic_duration = time.time() - critic_start

                    save_artifact(
                        "reviews",
                        f"review-{run_id}-sprint-{sprint['sprint_number']}"
                        f"-attempt-{retry_count + 1}.json",
                        review,
                    )
                    append_history(
                        state, "self_critique",
                        sprint=sprint["sprint_number"],
                        verdict=review.get("verdict"),
                        duration_s=round(critic_duration, 1),
                    )

                    # ── Self-Fix if needed ─────────────────────────
                    if review.get("verdict") == "self_correcting":
                        state["status"] = "self_fixing"
                        save_state(state)

                        with trace_span("self-fix", attributes={
                            "ai_builder.step": "self_fix",
                            "ai_builder.fixable_issues": len([
                                i for i in review.get("issues", [])
                                if i.get("auto_fixable")
                            ]),
                        }):
                            fix_start = time.time()
                            await run_self_fix(review, session_id)
                            fix_duration = time.time() - fix_start

                        with trace_span("self-critique-post-fix", attributes={
                            "ai_builder.step": "self_critique_post_fix",
                        }):
                            review2 = await run_self_critic(
                                sprint, contract, session_id,
                            )

                        save_artifact(
                            "reviews",
                            f"review-{run_id}-sprint-{sprint['sprint_number']}"
                            f"-attempt-{retry_count + 1}-fixed.json",
                            review2,
                        )
                        append_history(
                            state, "self_fix",
                            sprint=sprint["sprint_number"],
                            duration_s=round(fix_duration, 1),
                            post_fix_verdict=review2.get("verdict"),
                        )

                    # ── Evaluate ───────────────────────────────────
                    state["status"] = "evaluating"
                    save_state(state)

                    with trace_span("evaluate", attributes={
                        "ai_builder.step": "evaluate",
                    }):
                        eval_start = time.time()
                        qa_report = await run_evaluator(
                            contract, sprint, run_id,
                            attempt=retry_count + 1,
                        )
                        eval_duration = time.time() - eval_start

                    save_artifact(
                        "qa_reports",
                        f"qa-{run_id}-sprint-{sprint['sprint_number']}"
                        f"-attempt-{retry_count + 1}.json",
                        qa_report,
                    )
                    append_history(
                        state, "evaluating",
                        sprint=sprint["sprint_number"],
                        attempt=retry_count + 1,
                        score=qa_report.get("overall_score"),
                        verdict=qa_report.get("verdict"),
                        duration_s=round(eval_duration, 1),
                    )

                    # ── Record outcome on spans ────────────────────
                    verdict = qa_report.get("verdict", "unknown")
                    score = qa_report.get("overall_score", 0)
                    bug_count = len(qa_report.get("bugs", []))
                    if attempt_span:
                        attempt_span.set_attribute("ai_builder.verdict", verdict)
                        attempt_span.set_attribute("ai_builder.score", score)
                        attempt_span.set_attribute("ai_builder.bug_count", bug_count)

                    # ── Check Result ───────────────────────────────
                    if verdict == "pass":
                        print(
                            f"\n  Sprint {sprint['sprint_number']} PASSED "
                            f"(score: {score:.1f})"
                        )
                        _merge_sprint_branch(sprint, qa_report)
                        emit_sprint_end(run_id, sprint["sprint_number"], "pass", score)
                        append_history(
                            state, "merged",
                            sprint=sprint["sprint_number"],
                            score=score,
                        )
                        break
                    else:
                        retry_count += 1
                        print(
                            f"\n  Sprint {sprint['sprint_number']} attempt "
                            f"{retry_count} FAILED (score: {score:.1f}, "
                            f"{bug_count} bugs)"
                        )
                        if retry_count > config.max_retries:
                            logger.warning(
                                f"Sprint {sprint['sprint_number']} failed "
                                f"after {config.max_retries + 1} attempts"
                            )
                            emit_sprint_end(run_id, sprint["sprint_number"], "fail", score)
                            state["status"] = "sprint_failed"
                            save_state(state)
                            _git(["checkout", config.main_branch], check=False)
                            print(
                                f"\n  Sprint {sprint['sprint_number']} FAILED "
                                f"after {config.max_retries + 1} attempts. "
                                f"Branch left for manual inspection."
                            )
                            break

            # Set final outcome on the sprint span
            if sprint_span:
                final_verdict = state.get("status", "unknown")
                sprint_span.set_attribute("ai_builder.final_verdict", final_verdict)
                sprint_span.set_attribute("ai_builder.total_attempts", retry_count + 1)

    # ── Summary ────────────────────────────────────────────────────────
    total_duration = time.time() - total_start
    state["status"] = "complete"
    state["total_duration_s"] = round(total_duration, 1)
    save_state(state)
    emit_session_end(run_id, "complete", round(total_duration, 1))

    print(f"\n{'='*60}")
    print(f"  Build Complete")
    print(f"  Run ID: {run_id}")
    print(f"  Duration: {total_duration / 60:.1f} minutes")
    print(f"  Sprints: {len(sprints)}")
    print(f"{'='*60}")

    return state
