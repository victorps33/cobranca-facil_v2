from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = ""
    DIRECT_URL: str = ""
    ANTHROPIC_API_KEY: str = ""

    @property
    def async_database_url(self) -> str:
        """Convert postgres:// or postgresql:// DIRECT_URL to asyncpg format."""
        url = self.DIRECT_URL or self.DATABASE_URL
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        # Remove pgbouncer param if present (not needed for direct connection)
        url = url.split("?pgbouncer")[0]
        return url

    model_config = {
        "env_file": str(Path(__file__).resolve().parent.parent.parent.parent / ".env"),
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


settings = Settings()
