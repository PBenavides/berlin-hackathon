# AI Builder Harness

Autonomous Planner -> Generator -> Self-Critic -> Evaluator loop for any project.

## Project Context

The AI Builder is **project-agnostic**. It discovers project context at runtime by reading:
- **`CLAUDE.md`** at the project root — project overview, tech stack, structure, patterns
- **`docs/`** folder — architecture docs, feature specs, design decisions

Every project that uses AI Builder MUST have these two sources of truth. The agents read them before planning, generating, or reviewing code.

## For Generator Agents

Your working directory is the PARENT project (one level up from `.ai_builder/`).
- Read `CLAUDE.md` and `docs/` to understand the project's patterns and conventions
- Follow whatever tech stack, file structure, and coding patterns are documented there
- NEVER modify `.ai_builder/` files during feature implementation
- Commit after each feature: `[ai-builder/generator] description`

## For Evaluator Agents

- Read `CLAUDE.md` to find the dev server command, port, and auth flow
- Use Playwright MCP to interact with the UI like a real user
- Kill the dev server when done testing

## Running the Builder

```bash
cd .ai_builder
pip install -r requirements.txt

# Plan only
python run.py --dry-run "Add a leaderboard feature"

# Full build
python run.py "Add a leaderboard feature"

# Resume from existing spec
python run.py --spec artifacts/specs/spec-20260405-143022.json

# Start from specific sprint
python run.py --sprint 2 --spec artifacts/specs/spec-20260405-143022.json
```

## Artifacts

All inter-agent communication goes through `artifacts/`:
- `specs/` — Planner output (product specs)
- `sprint_contracts/` — Generator -> Evaluator handoff
- `reviews/` — Self-critic output
- `qa_reports/` — Evaluator QA reports
- `state.json` — Current run state

## Project Requirements

For AI Builder to work with a project, the project needs:

1. **`CLAUDE.md`** at the project root with:
   - Project overview and purpose
   - Tech stack
   - Project structure (directories, key files)
   - How to run the dev server (command + port)
   - Auth flow (if any) — how to sign up, log in, test credentials
   - Coding patterns and conventions
   - API response format
   - UI/frontend patterns

2. **`docs/`** folder with:
   - Architecture documentation
   - Feature specs
   - Design decisions
   - Any other context agents need to understand the project

3. **`config.py`** overrides (optional):
   - `dev_server_command` and `dev_server_url` in `config.py` if needed
   - These default to reading from CLAUDE.md but can be set explicitly
