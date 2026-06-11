from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import Settings, get_settings
from app.core.logging import configure_logging
from app.dependencies.service_dependency import get_job_service
from app.handlers.exception_handler import add_exception_handlers
from app.middlewares.cors_middleware import add_cors_middleware
from app.middlewares.logging_middleware import add_logging_middleware
from app.routes.router import api_router


def create_app(settings: Settings | None = None) -> FastAPI:
    if settings is None:
        settings = get_settings()

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
        yield
        await get_job_service().shutdown()

    _app = FastAPI(title=settings.app_name, debug=settings.debug, lifespan=lifespan)
    add_cors_middleware(_app, settings)
    _app.add_middleware(GZipMiddleware, minimum_size=1000)
    add_logging_middleware(_app)
    add_exception_handlers(_app)
    _app.include_router(api_router)

    for subdir in ("originals", "processed", "masks"):
        (settings.upload_path / subdir).mkdir(parents=True, exist_ok=True)

    _app.mount(
        "/uploads/originals",
        StaticFiles(directory=settings.upload_path / "originals"),
        name="uploads_originals",
    )
    _app.mount(
        "/uploads/processed",
        StaticFiles(directory=settings.upload_path / "processed"),
        name="uploads_processed",
    )
    _app.mount(
        "/uploads/masks",
        StaticFiles(directory=settings.upload_path / "masks"),
        name="uploads_masks",
    )

    return _app


configure_logging(get_settings().debug)
app = create_app()
