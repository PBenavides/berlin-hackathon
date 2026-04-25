"""Planner agent: expands a user prompt into a structured product spec."""

import json
import logging
import re

from claude_agent_sdk import ClaudeAgentOptions

from config import config
from src.comms import load_prompt
from src.sdk_helpers import run_agent

logger = logging.getLogger("ai_builder.planner")


def _build_planner_prompt(user_prompt: str, run_id: str) -> str:
    """Build the full prompt for the planner agent."""
    return f"""You are planning features for **{config.project_name}**.

## User Request
{user_prompt}

## Run ID
{run_id}

Read the project's CLAUDE.md, the docs/ folder, and key source files (models, routes) to understand what already exists. Then produce a comprehensive product spec following the output format in your system prompt.

Set "run_id" to "{run_id}" in your output.
Set "user_prompt" to the user request above.

Return ONLY the JSON spec. No other text."""


def _extract_json(text: str) -> dict:
    """Extract JSON from agent response, handling markdown fences."""
    # Try direct parse first
    text = text.strip()
    if text.startswith("{"):
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

    # Try extracting from markdown code fences
    match = re.search(r"```(?:json)?\s*\n(.*?)\n```", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass

    # Try finding JSON object embedded in surrounding text
    start = text.find("{")
    if start != -1:
        # Find the matching closing brace by counting depth
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

    raise ValueError(f"Could not extract valid JSON from planner output:\n{text[:500]}")


async def run_planner(user_prompt: str, run_id: str) -> dict:
    """Run the planner agent and return the product spec as a dict.

    Args:
        user_prompt: The user's feature request (1-4 sentences)
        run_id: Unique identifier for this build run

    Returns:
        Parsed spec dict matching the planner output schema
    """
    system_prompt = load_prompt("planner")
    prompt = _build_planner_prompt(user_prompt, run_id)

    logger.info(f"Starting planner for run {run_id}")
    logger.info(f"User prompt: {user_prompt}")

    result = await run_agent(
        prompt=prompt,
        options=ClaudeAgentOptions(
            model=config.planner_model,
            system_prompt=system_prompt,
            setting_sources=["project"],
            permission_mode="bypassPermissions",
            cwd=str(config.project_root),
            max_turns=config.planner_max_turns,
        ),
    )

    if result.is_error:
        raise RuntimeError(f"Planner agent failed: {result.error_detail}")
    if not result.result_text:
        raise RuntimeError("Planner returned empty result")

    spec = _extract_json(result.result_text)
    logger.info(
        f"Spec generated: {len(spec.get('sprints', []))} sprints, "
        f"{sum(len(s.get('features', [])) for s in spec.get('sprints', []))} features"
    )
    return spec
