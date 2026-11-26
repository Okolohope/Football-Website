from __future__ import annotations

from uuid import uuid4

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import UploadFile
from starlette.concurrency import run_in_threadpool

from .config import Settings


MAX_LOGO_BYTES = 2 * 1024 * 1024
MAX_BANNER_BYTES = 5 * 1024 * 1024
IMAGE_SIGNATURES = {
    "image/jpeg": (b"\xff\xd8\xff", ".jpg"),
    "image/png": (b"\x89PNG\r\n\x1a\n", ".png"),
}


class StorageUnavailable(Exception):
    pass


class ObjectStorage:
    def __init__(self, settings: Settings) -> None:
        if not settings.storage_is_configured:
            raise ValueError("Coach object storage is not configured")
        self.bucket = settings.coach_storage_bucket
        self.client = boto3.client(
            "s3",
            endpoint_url=str(settings.aws_endpoint_url_s3),
            region_name=settings.aws_region,
            aws_access_key_id=settings.aws_access_key_id.get_secret_value(),
            aws_secret_access_key=settings.aws_secret_access_key.get_secret_value(),
        )

    async def upload_logo(self, file: UploadFile, clerk_user_id: str) -> str:
        try:
            return await self.upload_image(
                bucket=self.bucket,
                file=file,
                key_prefix=f"coach-logos/{clerk_user_id}",
                max_bytes=MAX_LOGO_BYTES,
                size_error="The logo must be 2 MB or smaller",
                empty_error="The logo file is empty",
            )
        except StorageUnavailable as error:
            raise StorageUnavailable(
                "The team logo could not be uploaded") from error

    async def upload_image(
        self,
        bucket: str,
        file: UploadFile,
        key_prefix: str,
        max_bytes: int,
        size_error: str,
        empty_error: str = "The image file is empty",
    ) -> str:
        content = await file.read(max_bytes + 1)
        await file.close()
        if not content:
            raise ValueError(empty_error)
        if len(content) > max_bytes:
            raise ValueError(size_error)

        image_type = self._image_type(content)
        key = f"{key_prefix}/{uuid4().hex}{image_type[1]}"
        try:
            await run_in_threadpool(
                self.client.put_object,
                Bucket=bucket,
                Key=key,
                Body=content,
                ContentLength=len(content),
                ContentType=image_type[0],
            )
        except (BotoCoreError, ClientError) as error:
            raise StorageUnavailable("The image could not be uploaded") from error
        return key

    async def delete_logo(self, key: str) -> None:
        try:
            await self.delete_object(
                self.bucket,
                key,
                error_message="The orphaned team logo could not be removed",
            )
        except StorageUnavailable as error:
            raise StorageUnavailable(
                "The orphaned team logo could not be removed") from error

    async def delete_object(
        self,
        bucket: str,
        key: str,
        error_message: str = "The object could not be deleted",
    ) -> None:
        try:
            await run_in_threadpool(
                self.client.delete_object, Bucket=bucket, Key=key)
        except (BotoCoreError, ClientError) as error:
            raise StorageUnavailable(error_message) from error

    async def signed_url(self, key: str) -> str:
        try:
            return await self.signed_url_for(
                self.bucket,
                key,
                error_message="A temporary team logo URL could not be created",
            )
        except StorageUnavailable as error:
            raise StorageUnavailable(
                "A temporary team logo URL could not be created") from error

    async def signed_url_for(
        self,
        bucket: str,
        key: str,
        error_message: str = "A temporary object URL could not be created",
    ) -> str:
        try:
            return await run_in_threadpool(
                self.client.generate_presigned_url,
                "get_object",
                Params={"Bucket": bucket, "Key": key},
                ExpiresIn=900,
            )
        except (BotoCoreError, ClientError) as error:
            raise StorageUnavailable(error_message) from error

    @staticmethod
    def _image_type(content: bytes) -> tuple[str, str]:
        if content.startswith(IMAGE_SIGNATURES["image/jpeg"][0]):
            return "image/jpeg", IMAGE_SIGNATURES["image/jpeg"][1]
        if content.startswith(IMAGE_SIGNATURES["image/png"][0]):
            return "image/png", IMAGE_SIGNATURES["image/png"][1]
        if len(content) >= 12 and content.startswith(b"RIFF") and content[8:12] == b"WEBP":
            return "image/webp", ".webp"
        raise ValueError("Choose a valid JPEG, PNG, or WebP image")
