from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Database & Cache
    database_url: str = "postgresql://aquamekong:aquamekong_secret@localhost:5432/aquamekong"
    redis_url: str = "redis://localhost:6379/0"

    # ML Service
    ml_service_port: int = 8000
    # Tắt khi chạy nhiều worker/replica để job crawl không chạy trùng
    enable_scheduler: bool = True
    # Danh sách origin cách nhau bởi dấu phẩy (ML chủ yếu được backend gọi, không cần mở cho mọi nơi)
    cors_origins: str = "http://localhost:3000,http://localhost:5173"
    model_dir: str = "/app/trained_models"
    raw_data_dir: str = "../Data"

    # Model defaults
    default_lookback_days: int = 90
    default_forecast_days: int = 7

    # Cache kết quả dự báo (giây). Dữ liệu mới vào mỗi 15 phút, dự báo theo ngày.
    forecast_cache_ttl_seconds: int = 3600

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)


@lru_cache()
def get_settings() -> Settings:
    return Settings()
