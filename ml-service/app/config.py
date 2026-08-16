from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Database
    database_url: str = "postgresql://aquamekong:aquamekong_secret@localhost:5432/aquamekong"

    # ML Service
    ml_service_port: int = 8000
    model_dir: str = "/app/trained_models"

    # Model defaults
    default_lookback_days: int = 90
    default_forecast_days: int = 7

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    return Settings()
