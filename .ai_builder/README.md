# AI Builder

Autonomous **Planner → Generator → Self-Critic → Evaluator** loop for any project.

## Install

```bash
pip install -e /path/to/.ai_builder
```

Verify:

```bash
which ai-build
ai-build --help
```

## Usage

```bash
# Full build (plan + code + review + QA)
ai-build "Add a leaderboard feature"

# Plan only — no code written
ai-build --dry-run "Add dark mode"

# Resume last interrupted run
ai-build --resume

# Skip planning, use an existing spec
ai-build --spec .ai_builder/artifacts/specs/spec-<timestamp>.json

# Start from a specific sprint
ai-build --sprint 2 --spec .ai_builder/artifacts/specs/spec-<timestamp>.json

# Verbose output
ai-build -v "Add export to CSV"
```

## How it works

```
Planner  →  produces a spec (artifacts/specs/)
   ↓
Generator  →  writes code sprint-by-sprint, commits after each
   ↓
Self-Critic  →  reviews the diff, flags issues (artifacts/reviews/)
   ↓
Evaluator  →  spins up dev server, tests with Playwright (artifacts/qa_reports/)
```

State is persisted in `artifacts/state.json` — interrupted runs can be resumed.

## Project requirements

The project that AI Builder targets must have:

1. **`CLAUDE.md`** at the project root — tech stack, file structure, dev server command, auth flow, coding conventions
2. **`docs/`** folder — architecture docs, feature specs, design decisions

## Artifacts

| Path | Contents |
|------|----------|
| `artifacts/specs/` | Planner output — full product spec JSON |
| `artifacts/sprint_contracts/` | Per-sprint Generator → Evaluator handoff |
| `artifacts/reviews/` | Self-Critic output |
| `artifacts/qa_reports/` | Evaluator QA reports |
| `artifacts/state.json` | Current run state (for `--resume`) |
