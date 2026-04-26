"""Evaluator agent: QA testing via Playwright MCP."""

import json
import logging
import re

from claude_agent_sdk import ClaudeAgentOptions

from config import config
from src.comms import load_prompt
from src.sdk_helpers import run_agent_resilient

logger = logging.getLogger("ai_builder.evaluator")


def _build_evaluator_prompt(contract: dict, sprint: dict) -> str:
    """Build the full prompt for the evaluator agent."""
    return f"""## QA Testing: Sprint {sprint['sprint_number']} — {sprint['name']}

## Sprint Contract
{json.dumps(contract, indent=2)}

## Sprint Success Criteria
{json.dumps(sprint.get('success_criteria', []), indent=2)}

## Instructions
1. Start the dev server
2. Sign up or log in (check CLAUDE.md or the sprint contract for auth details)
3. Test EVERY feature listed in the contract using Playwright (click through the UI)
4. Test edge cases (empty inputs, invalid data, missing auth)
5. Run ALL regression checks
6. Score each dimension and calculate overall score
7. Document any bugs found with specific reproduction steps
8. Kill the dev server when done
9. Return ONLY the QA report JSON

Use Playwright to navigate the real UI — do not just use curl for API testing.
Open the browser to {config.dev_server_url} and interact with pages like a real user."""


def _incomplete_report(sprint: dict, attempt: int, result) -> dict:
    """Generate a fail report when the evaluator ran out of turns."""
    return {
        "verdict": "fail",
        "scores": {
            "functionality": 0,
            "product_depth": 0,
            "code_quality": 0,
            "regression": 0,
        },
        "overall_score": 0,
        "bugs": [
            {
                "id": "bug-incomplete",
                "severity": "high",
                "category": "functionality",
                "description": (
                    f"Evaluator ran out of turns ({len(result.tool_calls)} tool calls) "
                    f"before completing testing. This likely means the app had issues "
                    f"that required many interactions to diagnose."
                ),
                "steps_to_reproduce": ["Run evaluator with more turns or simpler test scope"],
                "expected": "Evaluator completes all tests within turn limit",
                "actual": f"Hit max turns after {len(result.tool_calls)} tool calls",
                "file_hint": None,
            }
        ],
        "regression_results": [],
        "notes": (
            f"INCOMPLETE: Evaluator hit max turns. "
            f"Tool calls: {len(result.tool_calls)}, cost: ${result.cost_usd:.2f}"
        ),
    }


def _extract_qa_report(text: str) -> dict:
    """Extract QA report JSON from evaluator output."""
    text = text.strip()
    if text.startswith("{"):
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

    matches = list(re.finditer(r"```(?:json)?\s*\n(.*?)\n```", text, re.DOTALL))
    if matches:
        # Take the last JSON block (the final report)
        try:
            return json.loads(matches[-1].group(1))
        except json.JSONDecodeError:
            pass

    # Try finding JSON object embedded in surrounding text
    start = text.find("{")
    if start != -1:
        depth = 0
        for i in range(start, len(text)):
            if text[i] == "{":
                depth += 1
            elif text[i] == "}":
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(text[start : i + 1])
                    except json.JSONDecodeError:
                        break

    raise ValueError("Could not extract QA report JSON from evaluator output")


async def run_evaluator(
    contract: dict,
    sprint: dict,
    run_id: str,
    attempt: int,
) -> dict:
    """Run the evaluator agent to test the sprint implementation.

    Args:
        contract: Sprint contract from generator
        sprint: Sprint spec being tested
        run_id: Build run identifier
        attempt: Attempt number (1-based)

    Returns:
        QA report dict with verdict, scores, and bugs
    """
    system_prompt = load_prompt("evaluator")
    prompt = _build_evaluator_prompt(contract, sprint)

    logger.info(
        f"Starting evaluator for sprint {sprint['sprint_number']}, "
        f"attempt {attempt}"
    )

    result = await run_agent_resilient(
        prompt=prompt,
        options=ClaudeAgentOptions(
            model=config.evaluator_model,
            system_prompt=system_prompt,
            permission_mode="bypassPermissions",
            cwd=str(config.work_dir),
            setting_sources=["project"],
            max_turns=config.evaluator_max_turns,
            mcp_servers={
                "playwright": {
                    "command": "npx",
                    "args": ["@playwright/mcp@latest"],
                }
            },
        ),
        max_attempts=config.agent_max_attempts,
        label=f"evaluator-sprint-{sprint['sprint_number']}",
    )

    # Handle max turns — evaluator ran out of turns mid-testing.
    # If it did real work (tool calls), treat as incomplete test with auto-fail.
    if result.is_error:
        if "error_max_turns" in result.error_detail and result.tool_calls:
            logger.warning(
                f"Evaluator hit max turns ({config.evaluator_max_turns}) "
                f"after {len(result.tool_calls)} tool calls. Generating fail report."
            )
            # Try to extract partial report if the evaluator wrote one
            if result.result_text:
                try:
                    qa_report = _extract_qa_report(result.result_text)
                    qa_report["notes"] = (
                        qa_report.get("notes", "") +
                        f" [INCOMPLETE: evaluator hit max turns after {len(result.tool_calls)} tool calls]"
                    )
                except ValueError:
                    qa_report = _incomplete_report(sprint, attempt, result)
            else:
                qa_report = _incomplete_report(sprint, attempt, result)

            qa_report["run_id"] = run_id
            qa_report["sprint_number"] = sprint["sprint_number"]
            qa_report["attempt"] = attempt
            qa_report["pass_threshold"] = config.pass_threshold
            qa_report["verdict"] = "fail"

            logger.info(
                f"Evaluator verdict: fail (incomplete — hit max turns, "
                f"{len(result.tool_calls)} tool calls, cost ${result.cost_usd:.2f})"
            )
            return qa_report
        else:
            # Non-max-turns error after retries — synthesize a fail report
            # so the orchestrator can move on instead of crashing.
            logger.error(
                f"Evaluator failed after retries: {result.error_detail}. "
                f"Generating synthetic fail report."
            )
            qa_report = _incomplete_report(sprint, attempt, result)
            qa_report["run_id"] = run_id
            qa_report["sprint_number"] = sprint["sprint_number"]
            qa_report["attempt"] = attempt
            qa_report["pass_threshold"] = config.pass_threshold
            qa_report["verdict"] = "fail"
            qa_report["notes"] = (
                f"Evaluator agent failed: {result.error_detail}. "
                f"Cost: ${result.cost_usd:.2f}"
            )
            return qa_report

    if not result.result_text:
        if result.tool_calls:
            logger.warning(
                f"Evaluator returned empty text after {len(result.tool_calls)} tool calls. "
                f"Generating fail report."
            )
            qa_report = _incomplete_report(sprint, attempt, result)
            qa_report["run_id"] = run_id
            qa_report["sprint_number"] = sprint["sprint_number"]
            qa_report["attempt"] = attempt
            qa_report["pass_threshold"] = config.pass_threshold
            qa_report["verdict"] = "fail"
            qa_report["notes"] = (
                f"Evaluator completed {len(result.tool_calls)} tool calls but "
                f"returned no QA report text. Cost: ${result.cost_usd:.2f}"
            )
            logger.info(f"Evaluator verdict: fail (empty result, {len(result.tool_calls)} tool calls)")
            return qa_report
        # Empty result and no tool calls — synthesize a fail report instead
        # of raising, so the orchestrator can move on.
        logger.error(
            "Evaluator returned empty result with no tool calls. "
            "Generating synthetic fail report."
        )
        qa_report = _incomplete_report(sprint, attempt, result)
        qa_report["run_id"] = run_id
        qa_report["sprint_number"] = sprint["sprint_number"]
        qa_report["attempt"] = attempt
        qa_report["pass_threshold"] = config.pass_threshold
        qa_report["verdict"] = "fail"
        qa_report["notes"] = "Evaluator returned no output and made no tool calls."
        return qa_report

    try:
        qa_report = _extract_qa_report(result.result_text)
    except ValueError as e:
        logger.error(f"Evaluator output unparseable ({e}); generating fail report")
        qa_report = _incomplete_report(sprint, attempt, result)
        qa_report["run_id"] = run_id
        qa_report["sprint_number"] = sprint["sprint_number"]
        qa_report["attempt"] = attempt
        qa_report["pass_threshold"] = config.pass_threshold
        qa_report["verdict"] = "fail"
        qa_report["notes"] = f"Evaluator output unparseable: {e}"
        return qa_report

    # Ensure metadata fields
    qa_report["run_id"] = run_id
    qa_report["sprint_number"] = sprint["sprint_number"]
    qa_report["attempt"] = attempt
    qa_report["pass_threshold"] = config.pass_threshold

    overall = qa_report.get("overall_score", 0)
    verdict = "pass" if overall >= config.pass_threshold else "fail"
    qa_report["verdict"] = verdict

    bug_count = len(qa_report.get("bugs", []))
    logger.info(
        f"Evaluator verdict: {verdict} (score: {overall:.1f}/{config.pass_threshold}, "
        f"{bug_count} bugs)"
    )
    return qa_report
