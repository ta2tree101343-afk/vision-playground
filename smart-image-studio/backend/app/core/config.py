from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

from app.schemas.pipeline import PipelineInterpreterMode


class Settings(BaseSettings):
    app_name: str = "Smart Image Studio API"
    debug: bool = False
    cors_origins: str = "http://localhost:5173"
    upload_dir: str = "uploads"
    pipeline_interpreter_mode: PipelineInterpreterMode = PipelineInterpreterMode.RULE_BASED
    llm_api_base_url: str = "https://api.openai.com/v1"
    llm_api_key: str = ""
    llm_model: str = ""
    llm_timeout_seconds: int = 30

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        env_prefix="SMART_IMAGE_STUDIO_",
    )

    @property
    def project_root(self) -> Path:
        return Path(__file__).resolve().parents[2]

    @property
    def upload_path(self) -> Path:
        return self.project_root / self.upload_dir

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
