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
    # Thả file xuất từ RYNAN vào đây, job định kỳ sẽ nạp vào DB (app/ingest/inbox.py)
    ingest_inbox_dir: str = "/app/data/inbox"
    # Kho feature (CSV định dạng features) cho ST-GNN, gộp mỗi lần nạp file features
    features_dir: str = "/app/data/features"
    # Crawler sinh số ngẫu nhiên (demo); tắt khi đã có dữ liệu thật
    enable_mock_crawler: bool = False
    # Link Google Drive (hoặc URL bất kỳ) tới file dữ liệu ban đầu; tự nạp khi DB chưa có trạm thật
    seed_data_url: str = ""
    # Folder Google Drive chứa rynan_YYYY-MM-DD.csv (GitHub Actions tải lên mỗi ngày) và API key để đọc nó.
    # Trống = tắt job tải về (app/ingest/drive_sync.py)
    gdrive_folder_id: str = ""
    gdrive_api_key: str = ""

    # Model defaults
    default_lookback_days: int = 90
    default_forecast_days: int = 7

    # Cache kết quả dự báo (giây). Dữ liệu mới vào mỗi 15 phút, dự báo theo ngày.
    forecast_cache_ttl_seconds: int = 3600

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)


@lru_cache()
def get_settings() -> Settings:
    return Settings()
