import os
from pydantic_settings import BaseSettings, SettingsConfigDict


DOTENV = os.path.join(os.path.dirname(__file__), ".env")


class Settings(BaseSettings):
    DB_HOST: str
    DB_PORT: int
    DB_USER: str
    DB_PASS: str
    DB_NAME: str
    GOOGLE_CLIENT_ID: str
    GOOGLE_CLIENT_SECRET: str
    SESSION_SECRET_KEY: str
    ORIGIN_FRONTEND: str
    ORIGIN_FRONTEND_BACKUP: str
    ORPO_USER: str
    ORPO_PASS: str
    ORPO_HOST: str
    ORPO_PORT: int
    ORPO_BD: str
    ACTIONSFLOW_DB_NAME: str
    TEST_BASE_URL: str
    TELEGRAM_BOT_TOKEN: str
    TELEGRAM_COMMON_ACTIONS_CHAT_ID: str
    TELEGRAM_COMMON_ACTIONS_TOPIC_ID: int | None = None
    TELEGRAM_FAQ_TOPIC_ID: int | None = None

    @property
    def DATABASE_URL_asyncpg(self):
        return f"postgresql+asyncpg://{self.DB_USER}:{self.DB_PASS}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

    @property
    def DATABASE_URL_psycopg(self):
        return f"postgresql+psycopg://{self.DB_USER}:{self.DB_PASS}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

    @property
    def ACTIONSFLOW_DATABASE_URL_asyncpg(self):
        return (
            f"postgresql+asyncpg://{self.DB_USER}:{self.DB_PASS}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.ACTIONSFLOW_DB_NAME}"
        )

    model_config = SettingsConfigDict(env_file=DOTENV)


settings = Settings()