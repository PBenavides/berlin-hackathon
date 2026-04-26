from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    database_url: str = "postgresql://buena:buena@localhost:5432/buena"
    environment: str = "development"
    proposal_engine: str = "stub"  # "stub" or "ai"
    openrouter_api_key: str = ""
    openai_api_key: str = ""
    slack_webhook_url: str = ""       # Outbound Slack webhook (optional)
    app_base_url: str = "http://localhost:3000"  # Frontend URL for deep links

    # Hermes concierge (see docs/HERMES_PLAN.md)
    hermes_enabled: bool = True
    hermes_bin: str = "hermes"
    hermes_profile_prefix: str = "owner_"
    hermes_timeout_s: int = 60
    hermes_profiles_dir: str = "/root/.hermes/profiles"
    attachments_dir: str = "./data/attachments"
    gcs_bucket: str = ""  # if set, attachments go to GCS instead of local disk
    documents_dir: str = "./data/documents"
    max_document_bytes: int = 25 * 1024 * 1024  # 25 MB
    vision_model: str = "google/gemini-3.1-flash-lite-preview"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
