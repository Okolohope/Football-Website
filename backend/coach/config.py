from functools import lru_cache
from pathlib import Path

from pydantic import AnyHttpUrl, Field, SecretStr, TypeAdapter, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).with_name(".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: SecretStr
    clerk_issuer_url: AnyHttpUrl
    frontend_origin: str
    coach_port: int = Field(default=8000, ge=1, le=65535)
    aws_endpoint_url_s3: AnyHttpUrl | None = None
    coach_storage_bucket: str | None = None
    coach_tournament_storage_bucket: str | None = None
    aws_region: str | None = None
    aws_access_key_id: SecretStr | None = None
    aws_secret_access_key: SecretStr | None = None

    @field_validator("clerk_issuer_url")
    @classmethod
    def clerk_issuer_must_be_an_origin(cls, value: AnyHttpUrl) -> AnyHttpUrl:
        if value.path not in ("", "/") or value.query or value.fragment:
            raise ValueError("CLERK_ISSUER_URL must not include a path")
        return value

    @field_validator("frontend_origin")
    @classmethod
    def frontend_origin_must_be_an_origin(cls, value: str) -> str:
        parsed = TypeAdapter(AnyHttpUrl).validate_python(value)
        if parsed.path not in ("", "/") or parsed.query or parsed.fragment:
            raise ValueError(
                "FRONTEND_ORIGIN must be an origin without a path")
        return str(parsed).rstrip("/")

    @model_validator(mode="after")
    def storage_settings_must_be_complete(self) -> "Settings":
        storage_values = (
            self.aws_endpoint_url_s3,
            self.coach_storage_bucket,
            self.aws_region,
            self.aws_access_key_id,
            self.aws_secret_access_key,
        )
        if any(value is not None for value in storage_values) and not all(
            value is not None for value in storage_values
        ):
            raise ValueError(
                "Configure AWS_ENDPOINT_URL_S3, COACH_STORAGE_BUCKET, AWS_REGION, "
                "AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY together"
            )
        if self.coach_storage_bucket and self.coach_storage_bucket.startswith("replace-"):
            raise ValueError(
                "Replace the COACH_STORAGE_BUCKET placeholder with the actual bucket name")
        if (
            self.coach_tournament_storage_bucket
            and self.coach_tournament_storage_bucket.startswith("replace-")
        ):
            raise ValueError(
                "Replace the COACH_TOURNAMENT_STORAGE_BUCKET placeholder "
                "with the actual bucket name")
        return self

    @property
    def clerk_issuer(self) -> str:
        return str(self.clerk_issuer_url).rstrip("/")

    @property
    def storage_is_configured(self) -> bool:
        return self.aws_endpoint_url_s3 is not None


@lru_cache
def get_settings() -> Settings:
    return Settings()
