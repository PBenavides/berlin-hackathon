"""Generator agent: implements sprint features with self-critic loop."""

import json
import logging
import re

from claude_agent_sdk import ClaudeAgentOptions

from config import config
from src.comms import load_prompt
from src.sdk_helpers import run_agent_resilient

logger = logging.getLogger("ai_builder.generator")


def _slugify(name: str) -> str:
    """Convert sprint name to branch-safe slug."""
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:40]


def _build_generator_prompt(
    spec: dict,
    sprint: dict,
    run_id: str,
    bug_report: dict | None = None,
) -> str:
    """Build the full prompt for the generator agent."""
    bug_section = ""
    if bug_report:
        bug_section = f"""
## Previous QA Bugs to Fix
The evaluator found these bugs in your previous attempt. Fix them ALL:

{json.dumps(bug_report.get('bugs', []), indent=2)}

Evaluator notes: {bug_report.get('notes', 'None')}
"""

    slug = _slugify(sprint["name"])
    branch = f"{config.branch_prefix}-{sprint['sprint_number']}-{slug}"

    return f"""## Task
Implement Sprint {sprint['sprint_number']}: {sprint['name']}

## Branch
Create and switch to branch: `{branch}`
Run: `git checkout -b {branch}` (or `git checkout {branch}` if it already exists from a retry)

## Sprint Specification
{json.dumps(sprint, indent=2)}

## Full Spec Constraints
{json.dumps(spec.get('constraints', []), indent=2)}

## Out of Scope
{json.dumps(spec.get('out_of_scope', []), indent=2)}
{bug_section}
## Instructions
1. Read CLAUDE.md and key source files to understand current patterns
2. Create the branch
3. Implement each feature in the order listed
4. Commit after each feature with format: [ai-builder/generator] description\\nSprint: {sprint['sprint_number']} | Feature: <id>
5. After ALL features are implemented, output the sprint contract as a ```json block

Set run_id to "{run_id}" in the contract.
Set branch to "{branch}" in the contract."""


def _extract_json(text: str) -> dict:
    """Extract JSON contract from generator output."""
    # Find the last JSON code block (contract should be at the end)
    matches = list(re.finditer(r"```(?:json)?\s*\n(.*?)\n```", text, re.DOTALL))
    for match in reversed(matches):
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            continue

    # Fall back to brace-depth counting to extract the last top-level JSON object
    last_valid = None
    start = 0
    while True:
        idx = text.find("{", start)
        if idx == -1:
            break
        depth = 0
        for i in range(idx, len(text)):
            if text[i] == "{":
                depth += 1
            elif text[i] == "}":
                depth -= 1
                if depth == 0:
                    candidate = text[idx : i + 1]
                    try:
                        parsed = json.loads(candidate)
                        last_valid = parsed
                    except json.JSONDecodeError:
                        pass
                    start = i + 1
                    break
        else:
            break

    if last_valid is not None:
        return last_valid

    raise ValueError("Could not extract sprint contract JSON from generator output")


async def run_generator(
    spec: dict,
    sprint: dict,
    run_id: str,
    bug_report: dict | None = None,
) -> tuple[dict | None, str | None]:
    """Run the generator agent for a sprint.

    Returns:
        (contract_dict, session_id) on success.
        (None, session_id_or_None) when the generator failed after all
        retries — orchestrator should treat the sprint as failed.
    """
    system_prompt = load_prompt("generator")
    prompt = _build_generator_prompt(spec, sprint, run_id, bug_report)

    logger.info(f"Starting generator for sprint {sprint['sprint_number']}: {sprint['name']}")
    if bug_report:
        logger.info(f"Retry mode: fixing {len(bug_report.get('bugs', []))} bugs")

    result = await run_agent_resilient(
        prompt=prompt,
        options=ClaudeAgentOptions(
            model=config.generator_model,
            system_prompt=system_prompt,
            setting_sources=["project"],
            permission_mode="bypassPermissions",
            cwd=str(config.project_root),
            max_turns=config.generator_max_turns,
            mcp_servers={
                "playwright": {
                    "command": "npx",
                    "args": ["@playwright/mcp@latest"],
                }
            }
        ),
        max_attempts=config.agent_max_attempts,
        label=f"generator-sprint-{sprint['sprint_number']}",
    )

    if result.is_error or not result.result_text:
        logger.error(
            f"Generator gave up for sprint {sprint['sprint_number']}: "
            f"{result.error_detail or 'empty result'}"
        )
        return None, result.session_id

    try:
        contract = _extract_json(result.result_text)
    except ValueError as e:
        logger.error(f"Generator output unparseable: {e}")
        return None, result.session_id

    logger.info(
        f"Contract: {len(contract.get('features_implemented', []))} features, "
        f"branch: {contract.get('branch', 'unknown')}"
    )
    return contract, result.session_id


async def run_self_critic(
    sprint: dict,
    contract: dict,
    generator_session_id: str,
) -> dict:
    """Run the self-critic by resuming the generator's session.

    The self-critic has full context from the generator's implementation
    because it resumes the same session.

    Args:
        sprint: Sprint spec being reviewed
        contract: Sprint contract from generator
        generator_session_id: Session ID to resume

    Returns:
        Review dict with verdict and issues
    """
    system_prompt = load_prompt("self_critic")

    prompt = f"""## Self-Review Time

You just implemented Sprint {sprint['sprint_number']}: {sprint['name']}.

Now switch to reviewer mode. Go through the self-critic checklist for every file you changed.

## Sprint Contract (what you implemented)
{json.dumps(contract, indent=2)}

Read each file you changed and review against the checklist in your system prompt.
Return ONLY the review JSON. No other text."""

    logger.info(f"Starting self-critic for sprint {sprint['sprint_number']}")

    result = await run_agent_resilient(
        prompt=prompt,
        options=ClaudeAgentOptions(
            model=config.generator_model,
            system_prompt=system_prompt,
            setting_sources=["project"],
            permission_mode="bypassPermissions",
            cwd=str(config.project_root),
            resume=generator_session_id,
            max_turns=config.self_critic_max_turns,
            mcp_servers={
                "playwright": {
                    "command": "npx",
                    "args": ["@playwright/mcp@latest"],
                }
            }
        ),
        max_attempts=config.agent_max_attempts,
        label=f"self-critic-sprint-{sprint['sprint_number']}",
    )

    if result.is_error or not result.result_text:
        logger.warning(
            f"Self-critic failed: {result.error_detail or 'empty'}; "
            f"defaulting to rework_needed verdict"
        )
        return {
            "verdict": "rework_needed",
            "issues": [],
            "_error": result.error_detail or "empty self-critic result",
        }

    try:
        review = _extract_json_review(result.result_text)
    except ValueError as e:
        logger.warning(f"Self-critic output unparseable ({e}); defaulting to rework_needed")
        return {
            "verdict": "rework_needed",
            "issues": [],
            "_error": f"unparseable: {e}",
        }

    high_issues = [i for i in review.get("issues", []) if i.get("severity") == "high"]
    logger.info(
        f"Self-critic verdict: {review.get('verdict')} "
        f"({len(review.get('issues', []))} issues, {len(high_issues)} high)"
    )
    return review


def _extract_json_review(text: str) -> dict:
    """Extract review JSON from self-critic output."""
    text = text.strip()
    if text.startswith("{"):
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

    match = re.search(r"```(?:json)?\s*\n(.*?)\n```", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
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

    raise ValueError("Could not extract review JSON from self-critic output")


async def run_self_fix(
    review: dict,
    generator_session_id: str,
) -> None:
    """Resume the generator session to fix self-critic issues.

    Args:
        review: Self-critic review with issues to fix
        generator_session_id: Session ID to resume
    """
    fixable_issues = [
        i for i in review.get("issues", [])
        if i.get("auto_fixable", False)
    ]

    if not fixable_issues:
        logger.info("No auto-fixable issues found, skipping self-fix")
        return

    issues_text = json.dumps(fixable_issues, indent=2)

    prompt = f"""## Fix Self-Critic Issues

Fix these issues identified in the self-review:

{issues_text}

For each fix:
1. Make the code change
2. Commit with format: [ai-builder/self-fix] <description>\\nSprint: N | Self-critic fix

Fix ALL issues listed above.

## Final Step (CRITICAL)
After all fixes, run `git status`. If there are ANY uncommitted changes:
```
git add -A
git commit -m "[ai-builder/self-fix] finalize fixes
Sprint: N | Self-critic final"
```
This commit triggers session tracking hooks — do not skip it."""

    logger.info(f"Starting self-fix for {len(fixable_issues)} issues")

    result = await run_agent_resilient(
        prompt=prompt,
        options=ClaudeAgentOptions(
            model=config.generator_model,
            setting_sources=["project"],
            permission_mode="bypassPermissions",
            cwd=str(config.project_root),
            resume=generator_session_id,
            max_turns=config.self_fix_max_turns,
        ),
        max_attempts=config.agent_max_attempts,
        label="self-fix",
    )

    if result.is_error:
        logger.warning(f"Self-fix ended with error: {result.error_detail}")
    else:
        logger.info(f"Self-fix completed. Cost: ${result.cost_usd:.4f}")
