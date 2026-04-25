# Entire Integration — AI Builder

## Overview

The AI Builder integrates with [Entire CLI](https://docs.entire.io) to capture session and reasoning data from autonomous coding runs. There are three layers of integration:

1. **Git hooks** — Entire's `commit-msg`, `post-commit`, `pre-push` hooks fire on every commit/push
2. **SDK hooks** — Entire's Claude Code hooks (`Stop`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`) fire during each agent SDK session
3. **External agent plugin** — `entire-agent-ai-builder` gives Entire visibility into the orchestration layer (build runs, sprints, verdicts)

## What's implemented

### External Agent Plugin (`bin/entire_agent_ai_builder.py`)

Binary on PATH as `entire-agent-ai-builder`. Implements the Entire external agent protocol v1:
- Discovery: `info`, `detect`
- Session management: `get-session-id`, `get-session-dir`, `resolve-session-file`, `read-session`, `write-session`
- Transcript: `read-transcript`, `chunk-transcript`, `reassemble-transcript`
- Hooks: `parse-hook`, `install-hooks`, `uninstall-hooks`, `are-hooks-installed`
- Transcript analysis: `get-transcript-position`, `extract-modified-files`, `extract-prompts`, `extract-summary`
- Hook response: `write-hook-response`
- Resume: `format-resume-command`

### Event Emitter (`src/entire_events.py`)

Writes JSONL events to `artifacts/events.jsonl` at orchestrator state transitions. Calls `entire attach --agent ai-builder` at session end to register with Entire.

### SDK Hook Loader (`src/hooks/hook_loader.py`)

Converts `entire_hooks.json` shell commands into async Python callables, injected into every `ClaudeAgentOptions` via `sdk_helpers.py`.

## What's NOT implemented yet

### Git push from agents

Currently agents commit but never push. This means:
- Entire's `pre-push` hook never fires from agent sessions
- Sprint branches exist only locally until the orchestrator merges to main
- Remote has no visibility into in-progress sprint work

### Proposed changes

**Generator prompt** (`prompts/generator.md`) — after the final commit:
```
4. Push the sprint branch to origin:
   git push -u origin <branch>
   NEVER push to main — only push the sprint branch.
```

**Self-fix prompt** (`src/agents/generator.py` ~line 291) — after final commit:
```
Then push the branch:
git push origin HEAD
NEVER push to main.
```

**Orchestrator** (`src/agents/orchestrator.py`, `_merge_sprint_branch()`) — after merge + tag:
```python
_git(["push", "origin", config.main_branch], check=False)
_git(["push", "origin", "--tags"], check=False)
```

### Safety constraints

- Agent prompts explicitly say "NEVER push to main"
- Only the orchestrator pushes main (after merge + tag)
- Sprint branches use `ai/sprint-*` naming — clearly distinct
- `check=False` on push so failures don't crash the build

## Files involved

| File | Role |
|---|---|
| `bin/entire_agent_ai_builder.py` | External agent plugin (all subcommands) |
| `src/entire_events.py` | JSONL event emitter + `entire attach` |
| `src/hooks/hook_loader.py` | Converts JSON hooks → SDK HookMatcher objects |
| `src/hooks/entire_hooks.json` | Hook definitions (shell commands) |
| `src/sdk_helpers.py` | Injects hooks into every `run_agent()` call |
| `src/agents/orchestrator.py` | Emits events at state transitions |
| `prompts/generator.md` | Generator agent instructions (commit + push) |
| `.claude_sdk/settings.json` | Claude Code hook config (reference) |
| `.entire/settings.json` | `external_agents: true` |

## Testing

```bash
# Plugin subcommands
ENTIRE_REPO_ROOT=$(git rev-parse --show-toplevel) entire-agent-ai-builder info
ENTIRE_REPO_ROOT=$(git rev-parse --show-toplevel) entire-agent-ai-builder detect

# After a build run
cat .ai_builder/artifacts/events.jsonl
entire sessions list
entire activity   # needs `entire login`

# Verify push happened
git branch -r     # should show origin/ai/sprint-*
```

## Install on new machine

```bash
cd <project-with-.ai_builder>/.ai_builder
pip install -e .
# Registers: ai-build + entire-agent-ai-builder on PATH
```
