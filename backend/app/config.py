from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

AIProvider = Literal["none", "openrouter", "openrouterperu", "openai", "ollama", "custom"]

PROVIDER_URLS: dict[str, str] = {
    "openrouter": "https://openrouter.ai/api/v1",
    "openrouterperu": "https://openrouterperu.teinor.dev/api/v1",
    "openai": "https://api.openai.com/v1",
    "ollama": "http://localhost:11434/v1",
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: Literal["development", "production", "test"] = "development"
    database_url: str = "postgresql+asyncpg://wabot:wabot@localhost:5432/wabot"
    api_key: SecretStr = SecretStr("")
    cors_origins: list[str] = ["http://localhost:5173"]
    public_url: str = "http://localhost:8000"

    business_name: str = "Mi Empresa"
    business_phone: str = "+51900000000"
    service_window_hours: int = 24
    typing_delay_ms: int = 700
    simulator_ack_delay_ms: int = 600

    media_dir: Path = Path("./data/media")
    max_upload_mb: int = 100

    ai_provider: AIProvider = "none"
    ai_base_url: str = ""
    ai_api_key: SecretStr = SecretStr("")
    ai_model: str = "openai/gpt-4o-mini"
    ai_fallback_model: str = ""
    ai_timeout_seconds: float = 45.0
    ai_temperature: float = 0.3
    ai_max_tokens: int = 600
    ai_history_size: int = 16

    config_dir: Path = Path("./config")

    webhook_url: str = ""
    webhook_secret: SecretStr = SecretStr("")
    webhook_max_attempts: int = 6

    @property
    def ai_url(self) -> str:
        return (self.ai_base_url or PROVIDER_URLS.get(self.ai_provider, "")).rstrip("/")

    @property
    def ai_enabled(self) -> bool:
        if self.ai_provider == "none" or not self.ai_url:
            return False
        return self.ai_provider == "ollama" or bool(self.ai_api_key.get_secret_value())


@lru_cache
def get_settings() -> Settings:
    return Settings()
