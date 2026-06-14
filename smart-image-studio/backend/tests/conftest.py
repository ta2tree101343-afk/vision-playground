from __future__ import annotations

import io
import os
from collections.abc import Generator
from contextlib import nullcontext
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.repositories.job_repository import JobRepository

# database_url has no default in Settings; set a placeholder so Settings() does not raise
# ValidationError during test collection/import. The client fixture overrides this with
# the real testcontainers URL before creating the app.
os.environ.setdefault("SMART_IMAGE_STUDIO_DATABASE_URL", "postgresql+psycopg://localhost/test_unconfigured")

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import Engine, create_engine, text
from sqlalchemy.orm import Session


def make_png_bytes(width: int = 10, height: int = 10, color: tuple[int, int, int] = (128, 128, 128)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (width, height), color=color).save(buf, format="PNG")
    return buf.getvalue()


@pytest.fixture
def png_bytes() -> bytes:
    return make_png_bytes()


def _all_cached_fns() -> list:
    from app.core.config import get_settings
    from app.dependencies.service_dependency import (
        get_caption_service,
        get_image_controller,
        get_image_processor,
        get_job_controller,
        get_job_repository,
        get_job_service,
        get_object_detection_service,
        get_ocr_service,
        get_storage_service,
    )
    return [
        get_settings,
        get_ocr_service,
        get_object_detection_service,
        get_caption_service,
        get_image_processor,
        get_storage_service,
        get_job_repository,
        get_job_service,
        get_image_controller,
        get_job_controller,
    ]


@pytest.fixture(autouse=True)
def clear_lru_caches() -> Generator[None, None, None]:
    for fn in _all_cached_fns():
        fn.cache_clear()
    yield
    for fn in _all_cached_fns():
        fn.cache_clear()


@pytest.fixture(scope="session")
def tmp_upload_dir(tmp_path_factory: pytest.TempPathFactory) -> Path:
    return tmp_path_factory.mktemp("uploads")


@pytest.fixture(scope="session")
def postgres_url() -> Generator[str, None, None]:
    from testcontainers.postgres import PostgresContainer

    with PostgresContainer("postgres:16-alpine") as pg:
        yield pg.get_connection_url(driver="psycopg")


@pytest.fixture(scope="session")
def db_engine(postgres_url: str) -> Generator[Engine, None, None]:
    from app.db.engine import _run_alembic_upgrade

    engine = create_engine(postgres_url)
    _run_alembic_upgrade(url=postgres_url)
    yield engine
    engine.dispose()


@pytest.fixture
def db_session(db_engine: Engine) -> Generator[Session, None, None]:
    with db_engine.connect() as conn:
        conn.begin()
        with Session(conn, join_transaction_mode="create_savepoint") as session:
            yield session
        conn.rollback()


@pytest.fixture
def job_repo(db_session: Session) -> "JobRepository":
    from app.repositories.job_repository import JobRepository

    return JobRepository(lambda: nullcontext(db_session))


@pytest.fixture()
def client(
    tmp_upload_dir: Path,
    monkeypatch: pytest.MonkeyPatch,
    postgres_url: str,
    db_engine: Engine,
) -> Generator[TestClient, None, None]:
    from app.core.config import get_settings
    from app.main import create_app

    monkeypatch.setenv("SMART_IMAGE_STUDIO_UPLOAD_DIR", str(tmp_upload_dir))
    monkeypatch.setenv("SMART_IMAGE_STUDIO_DATABASE_URL", postgres_url)
    get_settings.cache_clear()

    try:
        with TestClient(create_app()) as c:
            yield c
    finally:
        with db_engine.connect() as conn:
            conn.execute(text("TRUNCATE TABLE jobs"))
            conn.commit()
        get_settings.cache_clear()
