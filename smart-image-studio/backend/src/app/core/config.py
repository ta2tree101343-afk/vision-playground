from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Smart Image Studio API"
    debug: bool = False
    cors_origins: str = "http://localhost:5173"
    upload_dir: str = "uploads"
    database_url: str = "postgresql+psycopg://smart_image_studio:smart_image_studio@localhost:5432/smart_image_studio"
    llm_api_base_url: str = "http://localhost:1234/v1"
    llm_model: str = "qwen/qwen3-vl-8b"
    llm_api_key: str = "lm-studio"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        env_prefix="SMART_IMAGE_STUDIO_",
    )

    @property
    def project_root(self) -> Path:
        # backend/src/app/core/config.py -> parents[3] = backend/
        return Path(__file__).resolve().parents[3]

    @property
    def app_root(self) -> Path:
        # backend/src/app/core/config.py -> parents[1] = backend/src/app/
        return Path(__file__).resolve().parents[1]

    @property
    def assets_path(self) -> Path:
        return self.app_root / "assets"

    @property
    def ml_models_path(self) -> Path:
        return self.assets_path / "ml_models"

    @property
    def upload_path(self) -> Path:
        return self.project_root / self.upload_dir

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
