from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Postgres
    POSTGRES_USER: str = "vigil"
    POSTGRES_PASSWORD: str = "vigil"
    POSTGRES_DB: str = "vigil"
    POSTGRES_HOST: str = "postgres"
    POSTGRES_PORT: int = 5432

    # Redis / Celery
    REDIS_URL: str = "redis://redis:6379/0"
    CELERY_BROKER_URL: str = "redis://redis:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/2"

    # Secrets
    SECRET_KEY: str = "dev-only-insecure-secret-key"
    FERNET_SECRET: str = "dev-only-insecure-fernet-key-not-b64-safe="
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # First-boot admin seed
    SEED_ADMIN_USERNAME: str = "admin"
    SEED_ADMIN_PASSWORD: str = "Admin123!"

    # Prometheus / alerting
    PROMETHEUS_URL: str = "http://prometheus:9090"
    ALERT_EVAL_INTERVAL_SECONDS: int = 15
    NODE_EXPORTER_VERSION: str = "1.8.2"
    NODE_EXPORTER_PORT: int = 9100

    # File-based service discovery shared with the Prometheus container
    PROMETHEUS_FILE_SD_DIR: str = "/prometheus_file_sd"

    BACKEND_CORS_ORIGINS: list[str] = []

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+psycopg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
