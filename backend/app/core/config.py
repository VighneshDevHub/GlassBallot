from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "GlassBallot API"
    app_env: str = Field(default="development", alias="APP_ENV")
    debug: bool = Field(default=False, alias="DEBUG")
    api_prefix: str = "/api/v1"
    secret_key: str = Field(default="change-me", alias="SECRET_KEY")
    session_secret: str = Field(default="change-me-too", alias="SESSION_SECRET")
    database_url: str = Field(
        default="postgresql+asyncpg://glassballot:glassballot@postgres:5432/glassballot",
        alias="DATABASE_URL",
    )
    redis_url: str = Field(default="redis://redis:6379/0", alias="REDIS_URL")
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"], alias="CORS_ORIGINS")
    minio_endpoint: str = Field(default="minio:9000", alias="MINIO_ENDPOINT")
    minio_access_key: str = Field(default="glassballot", alias="MINIO_ACCESS_KEY")
    minio_secret_key: str = Field(default="glassballot-dev", alias="MINIO_SECRET_KEY")
    minio_bucket_reports: str = Field(default="reports", alias="MINIO_BUCKET_REPORTS")
    demo_mode: bool = Field(default=True, alias="DEMO_MODE")
    otp_provider: str = Field(default="development", alias="OTP_PROVIDER")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        populate_by_name=True,
        extra="ignore",
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
