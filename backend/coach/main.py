from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import Settings, get_settings
from .database import create_pool
from .routes import router
from .storage import ObjectStorage


def create_app(
    settings_override: Settings | None = None,
    initialize_services: bool = True,
) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        settings = settings_override or get_settings()
        app.state.settings = settings
        app.state.db_pool = create_pool(
            settings) if initialize_services else None
        app.state.object_storage = (
            ObjectStorage(settings)
            if initialize_services and settings.storage_is_configured
            else None
        )
        try:
            yield
        finally:
            if app.state.db_pool is not None:
                app.state.db_pool.close()

    app = FastAPI(
        title="ELEVN Coach API",
        version="0.1.0",
        description="Coach profiles and squads for the ELEVN football platform.",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            str((settings_override or get_settings()).frontend_origin)],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )
    app.include_router(router)

    @app.get("/healthz", tags=["health"])
    def health_check() -> dict[str, str]:
        return {"status": "ok", "service": "coach-api"}

    return app


app = create_app()
