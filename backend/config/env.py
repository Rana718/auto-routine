from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )

    db_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/auto_routine"
    jwt_secret_key: str = "your-secret-key-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 30
    admin_secret_key: str = "change-this-admin-secret-key"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
