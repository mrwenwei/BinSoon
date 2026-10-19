from functools import lru_cache
from pydantic import AliasChoices, SecretStr, Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import URL


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    postgres_user: str
    postgres_password: SecretStr
    postgres_db: str
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    admin_token: SecretStr | None = Field(default=None, validation_alias=AliasChoices("ADMIN_TOKEN", "DEMO_ADMIN_TOKEN"))
    simulation_capacity_liters: float = Field(default=120, gt=0, allow_inf_nan=False, validation_alias=AliasChoices("SIMULATION_CAPACITY_LITERS", "DEMO_CAPACITY_LITERS"))
    simulation_time_multiplier: float = Field(default=600, gt=0, allow_inf_nan=False, validation_alias=AliasChoices("SIMULATION_TIME_MULTIPLIER", "DEMO_TIME_MULTIPLIER"))
    demo_auth_enabled: bool = False
    demo_citizen_password: SecretStr | None = None
    demo_staff_password: SecretStr | None = None
    demo_admin_password: SecretStr | None = None
    cors_origins: list[str] = []
    media_backend: str = "local"
    media_directory: str = "/tmp/binsoon-media"
    media_bucket: str | None = None
    media_signing_service_account: str | None = None

    @property
    def database_url(self) -> URL:
        return URL.create("postgresql+psycopg", username=self.postgres_user,
                          password=self.postgres_password.get_secret_value(),
                          host=self.postgres_host, port=self.postgres_port,
                          database=self.postgres_db)


@lru_cache
def get_settings() -> Settings:
    return Settings()
