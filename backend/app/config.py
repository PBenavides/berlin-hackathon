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

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
