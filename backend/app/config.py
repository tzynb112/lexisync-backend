from pydantic_settings import BaseSettings
import os


def _fix_database_url(url: str) -> str:
    if url.startswith("postgresql://") and "+asyncpg" not in url:
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgres://") and "+asyncpg" not in url:
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)
    return url


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://lexisync:lexisync_pass@localhost:5432/lexisync_db"
    SECRET_KEY: str = "your-super-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.DATABASE_URL = _fix_database_url(self.DATABASE_URL)

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
