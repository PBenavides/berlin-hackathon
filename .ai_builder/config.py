"""Configuration for the AI Builder harness.

Project-agnostic: detects project context from the parent directory's
CLAUDE.md and docs/ folder. No hardcoded project references here.
"""

import os
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class BuildConfig:
    # Paths
    project_root: Path = field(
        default_factory=lambda: Path(__file__).resolve().parent.parent
    )
    ai_builder_root: Path = field(default=None)
    artifacts_dir: Path = field(default=None)
    prompts_dir: Path = field(default=None)

    # Project identity (auto-detected from parent folder name)
    project_name: str = field(default=None)

    # Models
    planner_model: str = "opus"
    generator_model: str = "sonnet"
    evaluator_model: str = "sonnet"

    # Budget caps (runaway prevention even on Max Plan)
    planner_budget: float = 2.0
    generator_budget: float = 15.0
    self_critic_budget: float = 3.0
    self_fix_budget: float = 5.0
    evaluator_budget: float = 8.0

    # Turn limits
    planner_max_turns: int = 30
    generator_max_turns: int = 200
    self_critic_max_turns: int = 30
    self_fix_max_turns: int = 80
    evaluator_max_turns: int = 500

    # Retry / thresholds
    max_retries: int = 1
    pass_threshold: float = 7.5

    # Git
    main_branch: str = "main"
    branch_prefix: str = "ai/sprint"

    # Dev server
    dev_server_command: str = "python -m uvicorn src.main:app --reload --host 0.0.0.0 --port 8000"
    dev_server_url: str = "http://localhost:8000"

    # Observability (opt-in)
    tracing_enabled: bool = False
    phoenix_endpoint: str | None = None
    phoenix_api_key: str | None = None
    phoenix_project_name: str | None = None

    def __post_init__(self):
        if self.ai_builder_root is None:
            self.ai_builder_root = Path(__file__).resolve().parent
        if self.artifacts_dir is None:
            self.artifacts_dir = self.ai_builder_root / "artifacts"
        if self.prompts_dir is None:
            self.prompts_dir = self.ai_builder_root / "prompts"
        if self.project_name is None:
            self.project_name = self.project_root.name

        # Observability defaults and env var overrides
        if self.phoenix_project_name is None:
            self.phoenix_project_name = self.project_name
        if os.environ.get("AI_BUILDER_TRACING") == "1":
            self.tracing_enabled = True
        if os.environ.get("PHOENIX_ENDPOINT"):
            self.phoenix_endpoint = os.environ["PHOENIX_ENDPOINT"]
        if os.environ.get("PHOENIX_API_KEY"):
            self.phoenix_api_key = os.environ["PHOENIX_API_KEY"]


# Singleton config
config = BuildConfig()
