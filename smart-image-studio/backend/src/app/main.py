import asyncio
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import get_settings
from app.core.logging import configure_logging
from app.core.responses import UnicodeJSONResponse
from app.db.engine import _run_alembic_upgrade
from app.dependencies.service_dependency import get_job_repository, get_job_service
from app.handlers.exception_handler import add_exception_handlers
from app.middlewares.cors_middleware import add_cors_middleware
from app.middlewares.logging_middleware import add_logging_middleware
from app.routes.router import api_router


def create_app() -> FastAPI:
    settings = get_settings()

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
        await asyncio.to_thread(_run_alembic_upgrade)
        get_job_repository().mark_interrupted_jobs()
        yield
        await get_job_service().shutdown()

    _app = FastAPI(title=settings.app_name, debug=settings.debug, lifespan=lifespan, default_response_class=UnicodeJSONResponse)
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
