# PostgreSQL Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the in-memory + JSON file `JobRepository` with a PostgreSQL-backed implementation using SQLAlchemy 2.x (sync), Alembic migrations, and testcontainers-based tests.

**Architecture:** A new `app/db/` package holds the SQLAlchemy ORM model (`JobModel`) and session factory. `JobRepository` is rewritten to use `Session` via a callable factory, keeping the same public interface (`save`/`find`/`list_recent`/`remove`) so `JobService` needs no changes. Startup migrates the DB via `alembic upgrade head` in the FastAPI lifespan.

**Tech Stack:** SQLAlchemy 2.x (sync), psycopg3 (already in deps), Alembic, testcontainers-python[postgres], PostgreSQL 16

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `backend/src/app/db/__init__.py` | Package marker |
| Create | `backend/src/app/db/engine.py` | `make_session_factory()` + `_run_alembic_upgrade()` |
| Create | `backend/src/app/db/models/__init__.py` | Package marker |
| Create | `backend/src/app/db/models/job_model.py` | `Base` + `JobModel` ORM class |
| Create | `backend/alembic.ini` | Alembic configuration |
| Create | `backend/alembic/env.py` | Alembic migration runner |
| Create | `backend/alembic/versions/0001_create_jobs_table.py` | Initial schema migration |
| Rewrite | `backend/src/app/repositories/job_repository.py` | SQLAlchemy implementation, `mark_interrupted_jobs()` |
| Modify | `backend/src/app/dependencies/service_dependency.py` | Inject `SessionLocal` instead of `Path` |
| Modify | `backend/src/app/main.py` | Run migrations + `mark_interrupted_jobs` in lifespan |
| Modify | `backend/docker-compose.yml` | Add postgres service |
| Modify | `backend/.env.example` | Add `SMART_IMAGE_STUDIO_DATABASE_URL` |
| Modify | `backend/pyproject.toml` | Add `alembic`, `testcontainers[postgres]` |
| Modify | `backend/tests/conftest.py` | testcontainers fixtures, update `client` fixture |
| Rewrite | `backend/tests/unit/test_job_repository.py` | DB-backed tests |

---

## Task 1: Add dependencies

**Files:**
- Modify: `backend/pyproject.toml`

- [ ] **Step 1: Add alembic and testcontainers to pyproject.toml**

In `[tool.poetry.dependencies]`, add:
```toml
alembic = ">=1.13,<2.0"
```

In `[tool.poetry.group.dev.dependencies]`, add:
```toml
testcontainers = {extras = ["postgres"], version = ">=4.0,<5.0"}
```

- [ ] **Step 2: Install dependencies**

```bash
cd backend && poetry install
```

Expected: resolves and installs `alembic` and `testcontainers[postgres]` without errors.

- [ ] **Step 3: Verify imports work**

```bash
poetry run python -c "import alembic; from testcontainers.postgres import PostgresContainer; print('ok')"
```

Expected output: `ok`

---

## Task 2: Create app/db/ package with engine and migration helper

**Files:**
- Create: `backend/src/app/db/__init__.py`
- Create: `backend/src/app/db/engine.py`

- [ ] **Step 1: Create package marker**

Create `backend/src/app/db/__init__.py` as an empty file.

- [ ] **Step 2: Create engine.py**

Create `backend/src/app/db/engine.py`:

```python
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker


def make_session_factory(database_url: str) -> sessionmaker[Session]:
    engine = create_engine(database_url, pool_pre_ping=True)
    return sessionmaker(engine)


def _run_alembic_upgrade(url: str | None = None) -> None:
    from alembic import command
    from alembic.config import Config

    from app.core.config import get_settings

    alembic_ini = Path(__file__).resolve().parents[3] / "alembic.ini"
    cfg = Config(str(alembic_ini))
    cfg.set_main_option("sqlalchemy.url", url if url is not None else get_settings().database_url)
    command.upgrade(cfg, "head")
```

`parents[3]` from `backend/src/app/db/engine.py` resolves to `backend/`, where `alembic.ini` will live.

- [ ] **Step 3: Verify the module imports cleanly (no DB needed)**

```bash
cd backend && PYTHONPATH=src poetry run python -c "from app.db.engine import make_session_factory; print('ok')"
```

Expected: `ok`

---

## Task 3: Create SQLAlchemy ORM model

**Files:**
- Create: `backend/src/app/db/models/__init__.py`
- Create: `backend/src/app/db/models/job_model.py`

- [ ] **Step 1: Create package marker**

Create `backend/src/app/db/models/__init__.py` as an empty file.

- [ ] **Step 2: Create job_model.py**

Create `backend/src/app/db/models/job_model.py`:

```python
from datetime import datetime
from typing import Any

from sqlalchemy import CheckConstraint, DateTime, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class JobModel(Base):
    __tablename__ = "jobs"
    __table_args__ = (
        CheckConstraint(
            "status IN ('queued', 'running', 'completed', 'failed')",
            name="ck_jobs_status",
        ),
        Index("ix_jobs_created_at", "created_at"),
    )

    job_id: Mapped[str] = mapped_column(Text, primary_key=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    progress: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    message: Mapped[str] = mapped_column(Text, nullable=False, server_default="")
    filename: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    applied_operations: Mapped[list[Any]] = mapped_column(JSONB, nullable=False)
    result: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
```

- [ ] **Step 3: Verify model imports cleanly**

```bash
cd backend && PYTHONPATH=src poetry run python -c "from app.db.models.job_model import Base, JobModel; print('ok')"
```

Expected: `ok`

---

## Task 4: Set up Alembic

**Files:**
- Create: `backend/alembic.ini`
- Create: `backend/alembic/env.py`
- Create: `backend/alembic/versions/0001_create_jobs_table.py`

- [ ] **Step 1: Create alembic.ini**

Create `backend/alembic.ini`:

```ini
[alembic]
script_location = alembic
sqlalchemy.url = postgresql+psycopg://smart_image_studio:smart_image_studio@localhost:5432/smart_image_studio

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console
qualname =

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
```

Note: the `sqlalchemy.url` here is the default fallback. `_run_alembic_upgrade()` always overrides it programmatically before running.

- [ ] **Step 2: Create alembic/env.py**

Create `backend/alembic/env.py`:

```python
import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import engine_from_config, pool

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from app.db.models.job_model import Base

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


run_migrations_online()
```

`parents[1]` from `backend/alembic/env.py` = `backend/`, and adding `"src"` gives `backend/src` — the correct PYTHONPATH root.

- [ ] **Step 3: Create the initial migration**

Create `backend/alembic/versions/0001_create_jobs_table.py`:

```python
"""create jobs table

Revision ID: 0001
Revises:
Create Date: 2026-06-11
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "jobs",
        sa.Column("job_id", sa.Text(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("progress", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("message", sa.Text(), nullable=False, server_default=""),
        sa.Column("filename", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "applied_operations",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column("result", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.CheckConstraint(
            "status IN ('queued', 'running', 'completed', 'failed')",
            name="ck_jobs_status",
        ),
        sa.PrimaryKeyConstraint("job_id"),
    )
    op.create_index("ix_jobs_created_at", "jobs", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_jobs_created_at", table_name="jobs")
    op.drop_table("jobs")
```

- [ ] **Step 4: Commit infrastructure setup**

```bash
cd backend && git add alembic.ini alembic/ src/app/db/ && git commit -m "feat: add SQLAlchemy ORM model and Alembic setup for PostgreSQL migration"
```

---

## Task 5: Add testcontainers fixtures to conftest.py

**Files:**
- Modify: `backend/tests/conftest.py`

- [ ] **Step 1: Replace conftest.py with updated version**

Replace the full contents of `backend/tests/conftest.py`:

```python
import io
from collections.abc import Generator
from contextlib import nullcontext
from pathlib import Path

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
        get_image_processor,
        get_job_repository,
        get_job_service,
        get_storage_service,
    )
    return [get_settings, get_image_processor, get_storage_service, get_job_repository, get_job_service]


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

    with TestClient(create_app()) as c:
        yield c

    with db_engine.connect() as conn:
        conn.execute(text("TRUNCATE TABLE jobs"))
        conn.commit()
    get_settings.cache_clear()
```

The `job_repo` fixture passes `lambda: nullcontext(db_session)` as the factory. `nullcontext` wraps the existing session as a context manager without calling `close()` on it between repository calls, preserving the SAVEPOINT transaction for the full test.

---

## Task 6: Write failing tests for the new JobRepository

**Files:**
- Rewrite: `backend/tests/unit/test_job_repository.py`

- [ ] **Step 1: Replace test_job_repository.py with new tests**

Replace the full contents of `backend/tests/unit/test_job_repository.py`:

```python
from datetime import datetime, timezone

from app.repositories.job_repository import JobRepository
from app.schemas.image import ImageOperationStep, OperationType, ProcessImageResponse
from app.schemas.job import ImageProcessJob, JobStatus
from app.utils.datetime_util import utc_now


def _queued_job(job_id: str) -> ImageProcessJob:
    return ImageProcessJob(
        job_id=job_id,
        status=JobStatus.QUEUED,
        progress=0,
        message="queued",
        filename="test.jpg",
        created_at=utc_now(),
        applied_operations=[ImageOperationStep(operation=OperationType.GRAYSCALE)],
    )


def _running_job(job_id: str) -> ImageProcessJob:
    return ImageProcessJob(
        job_id=job_id,
        status=JobStatus.RUNNING,
        progress=50,
        message="running",
        filename="test.jpg",
        created_at=utc_now(),
        started_at=utc_now(),
        applied_operations=[ImageOperationStep(operation=OperationType.GRAYSCALE)],
    )


def _completed_job(job_id: str) -> ImageProcessJob:
    return ImageProcessJob(
        job_id=job_id,
        status=JobStatus.COMPLETED,
        progress=100,
        message="done",
        filename="test.jpg",
        created_at=utc_now(),
        started_at=utc_now(),
        completed_at=utc_now(),
        applied_operations=[ImageOperationStep(operation=OperationType.GRAYSCALE)],
        result=ProcessImageResponse(
            message="done",
            original_image_url="http://test/orig.jpg",
            processed_image_url="http://test/proc.jpg",
            processed_filename="proc.jpg",
            applied_operations=[],
        ),
    )


def test_find_returns_none_for_unknown_job(job_repo: JobRepository) -> None:
    assert job_repo.find("nonexistent") is None


def test_save_and_find_roundtrip(job_repo: JobRepository) -> None:
    job = _queued_job("job-1")
    job_repo.save(job)
    result = job_repo.find("job-1")
    assert result is not None
    assert result.job_id == "job-1"
    assert result.status == JobStatus.QUEUED
    assert result.filename == "test.jpg"
    assert len(result.applied_operations) == 1
    assert result.applied_operations[0].operation == OperationType.GRAYSCALE


def test_save_overwrites_existing_job(job_repo: JobRepository) -> None:
    job_repo.save(_queued_job("job-2"))
    job_repo.save(_running_job("job-2"))
    result = job_repo.find("job-2")
    assert result is not None
    assert result.status == JobStatus.RUNNING


def test_remove_deletes_job(job_repo: JobRepository) -> None:
    job_repo.save(_queued_job("job-3"))
    job_repo.remove("job-3")
    assert job_repo.find("job-3") is None


def test_remove_nonexistent_job_does_not_raise(job_repo: JobRepository) -> None:
    job_repo.remove("nonexistent")


def test_list_recent_returns_jobs_sorted_by_created_at_desc(job_repo: JobRepository) -> None:
    old = ImageProcessJob(
        job_id="old",
        status=JobStatus.QUEUED,
        progress=0,
        message="old",
        filename="old.jpg",
        created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        applied_operations=[],
    )
    new = ImageProcessJob(
        job_id="new",
        status=JobStatus.QUEUED,
        progress=0,
        message="new",
        filename="new.jpg",
        created_at=datetime(2026, 6, 1, tzinfo=timezone.utc),
        applied_operations=[],
    )
    job_repo.save(old)
    job_repo.save(new)
    jobs = job_repo.list_recent(10)
    assert len(jobs) == 2
    assert jobs[0].job_id == "new"
    assert jobs[1].job_id == "old"


def test_list_recent_respects_limit(job_repo: JobRepository) -> None:
    for i in range(5):
        job_repo.save(_queued_job(f"limit-{i}"))
    assert len(job_repo.list_recent(3)) == 3


def test_mark_interrupted_marks_queued_as_failed(job_repo: JobRepository) -> None:
    job_repo.save(_queued_job("q-job"))
    job_repo.mark_interrupted_jobs()
    job = job_repo.find("q-job")
    assert job is not None
    assert job.status == JobStatus.FAILED
    assert job.error_message is not None
    assert job.started_at is not None
    assert job.completed_at is not None


def test_mark_interrupted_preserves_started_at_for_running_job(job_repo: JobRepository) -> None:
    running = _running_job("r-job")
    original_started_at = running.started_at
    job_repo.save(running)
    job_repo.mark_interrupted_jobs()
    job = job_repo.find("r-job")
    assert job is not None
    assert job.status == JobStatus.FAILED
    assert job.started_at == original_started_at


def test_mark_interrupted_leaves_completed_job_unchanged(job_repo: JobRepository) -> None:
    job_repo.save(_completed_job("c-job"))
    job_repo.mark_interrupted_jobs()
    job = job_repo.find("c-job")
    assert job is not None
    assert job.status == JobStatus.COMPLETED


def test_completed_job_roundtrip_preserves_result(job_repo: JobRepository) -> None:
    job_repo.save(_completed_job("c-2"))
    result = job_repo.find("c-2")
    assert result is not None
    assert result.result is not None
    assert result.result.original_image_url == "http://test/orig.jpg"
    assert result.result.processed_image_url == "http://test/proc.jpg"
```

- [ ] **Step 2: Run tests to confirm they fail (current JobRepository has wrong interface)**

```bash
cd backend && poetry run task test tests/unit/test_job_repository.py -v 2>&1 | tail -20
```

Expected: tests fail because `JobRepository` constructor still takes `Path`, not a session factory.

---

## Task 7: Rewrite JobRepository

**Files:**
- Rewrite: `backend/src/app/repositories/job_repository.py`

- [ ] **Step 1: Replace job_repository.py**

Replace the full contents of `backend/src/app/repositories/job_repository.py`:

```python
import logging
from collections.abc import Callable
from contextlib import AbstractContextManager

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.constants import JOB_HISTORY_LIMIT
from app.db.models.job_model import JobModel
from app.schemas.job import ImageProcessJob, JobStatus
from app.utils.datetime_util import utc_now

logger = logging.getLogger(__name__)

_SessionFactory = Callable[[], AbstractContextManager[Session]]


def _to_domain(row: JobModel) -> ImageProcessJob:
    return ImageProcessJob.model_validate({
        "job_id": row.job_id,
        "status": row.status,
        "progress": row.progress,
        "message": row.message,
        "filename": row.filename,
        "created_at": row.created_at,
        "started_at": row.started_at,
        "completed_at": row.completed_at,
        "applied_operations": row.applied_operations,
        "result": row.result,
        "error_message": row.error_message,
    })


def _from_domain(job: ImageProcessJob) -> JobModel:
    return JobModel(
        job_id=job.job_id,
        status=job.status.value,
        progress=job.progress,
        message=job.message,
        filename=job.filename,
        created_at=job.created_at,
        started_at=job.started_at,
        completed_at=job.completed_at,
        applied_operations=job.model_dump(mode="json")["applied_operations"],
        result=job.result.model_dump(mode="json") if job.result is not None else None,
        error_message=job.error_message,
    )


class JobRepository:
    def __init__(self, session_factory: _SessionFactory) -> None:
        self._session_factory = session_factory

    def find(self, job_id: str) -> ImageProcessJob | None:
        with self._session_factory() as session:
            row = session.get(JobModel, job_id)
            return _to_domain(row) if row is not None else None

    def save(self, job: ImageProcessJob, *, persist: bool = True) -> None:
        with self._session_factory() as session:
            session.merge(_from_domain(job))
            session.commit()

    def list_recent(self, limit: int) -> list[ImageProcessJob]:
        with self._session_factory() as session:
            rows = session.scalars(
                select(JobModel).order_by(JobModel.created_at.desc()).limit(limit)
            ).all()
            return [_to_domain(r) for r in rows]

    def remove(self, job_id: str) -> None:
        with self._session_factory() as session:
            if row := session.get(JobModel, job_id):
                session.delete(row)
                session.commit()

    def mark_interrupted_jobs(self) -> None:
        interrupted_at = utc_now()
        with self._session_factory() as session:
            rows = session.scalars(
                select(JobModel).where(JobModel.status.in_(["queued", "running"]))
            ).all()
            for row in rows:
                row.status = "failed"
                row.completed_at = interrupted_at
                row.message = "サーバー再起動によりジョブが中断しました。"
                row.error_message = "サーバー再起動によりジョブが中断しました。"
                if row.started_at is None:
                    row.started_at = interrupted_at
            session.commit()
```

The `persist` flag is accepted for interface compatibility with the existing `JobService._update_job` call but ignored — every save writes to the DB.

`_to_domain` uses `model_validate` with a raw dict; Pydantic deserializes the JSONB columns (already Python `list`/`dict` from psycopg3) back into `list[ImageOperationStep]` and `ProcessImageResponse` using its normal coercive validation.

- [ ] **Step 2: Run repository unit tests**

```bash
cd backend && poetry run task test tests/unit/test_job_repository.py -v
```

Expected: all 11 tests pass.

If tests fail, check:
- Docker daemon is running (testcontainers needs it)
- psycopg3 driver string is `postgresql+psycopg://` (not `postgresql+psycopg2://`)
- `join_transaction_mode="create_savepoint"` is supported by your SQLAlchemy 2.x version (requires ≥ 2.0.0rc1)

- [ ] **Step 3: Commit**

```bash
cd backend && git add src/app/repositories/job_repository.py src/app/db/ alembic/ alembic.ini tests/conftest.py tests/unit/test_job_repository.py pyproject.toml poetry.lock && git commit -m "feat: replace JSON file JobRepository with PostgreSQL via SQLAlchemy"
```

---

## Task 8: Update service_dependency.py

**Files:**
- Modify: `backend/src/app/dependencies/service_dependency.py`

- [ ] **Step 1: Update get_job_repository to inject SessionLocal**

Replace `get_job_repository` in `backend/src/app/dependencies/service_dependency.py`:

```python
@lru_cache
def get_job_repository() -> JobRepository:
    from app.db.engine import make_session_factory
    return JobRepository(make_session_factory(get_settings().database_url))
```

Remove the `from pathlib import Path` import if it is no longer used by any other function in the file.

The full updated file:

```python
from functools import lru_cache

from app.core.config import get_settings
from app.repositories.job_repository import JobRepository
from app.services.image_processor import ImageProcessor
from app.services.job_service import JobService
from app.services.storage_service import StorageService
from app.usecases.image_usecase import ImageUsecase


@lru_cache
def get_image_processor() -> ImageProcessor:
    return ImageProcessor()


@lru_cache
def get_storage_service() -> StorageService:
    settings = get_settings()
    return StorageService(settings.upload_path)


@lru_cache
def get_job_repository() -> JobRepository:
    from app.db.engine import make_session_factory
    return JobRepository(make_session_factory(get_settings().database_url))


@lru_cache
def get_job_service() -> JobService:
    return JobService(
        image_processor=get_image_processor(),
        storage_service=get_storage_service(),
        job_repository=get_job_repository(),
    )


def get_image_usecase() -> ImageUsecase:
    return ImageUsecase(get_image_processor(), get_storage_service())
```

- [ ] **Step 2: Run type check**

```bash
cd backend && poetry run task typecheck
```

Expected: `Success: no issues found in N source files`

---

## Task 9: Update main.py lifespan to run migrations and mark interrupted jobs

**Files:**
- Modify: `backend/src/app/main.py`

- [ ] **Step 1: Add asyncio import and update lifespan**

Replace `backend/src/app/main.py`:

```python
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
```

- [ ] **Step 2: Run all tests**

```bash
cd backend && poetry run task test -v 2>&1 | tail -30
```

Expected: all tests pass. The integration tests (`test_job_api.py`) will now use the real PostgreSQL container via `client` fixture and the lifespan will run migrations (idempotent) on each `TestClient` start.

If `test_get_jobs_returns_empty_list_initially` fails: the `jobs` table is not being truncated between tests. Check that the `client` fixture's `TRUNCATE TABLE jobs` cleanup block runs correctly.

- [ ] **Step 3: Commit**

```bash
cd backend && git add src/app/main.py src/app/dependencies/service_dependency.py && git commit -m "feat: wire PostgreSQL repository into DI and run migrations on startup"
```

---

## Task 10: Update docker-compose.yml

**Files:**
- Modify: `docker-compose.yml` (at repo root `smart-image-studio/docker-compose.yml`)

- [ ] **Step 1: Add postgres service and update backend dependency**

Replace the full `docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: smart_image_studio
      POSTGRES_PASSWORD: smart_image_studio
      POSTGRES_DB: smart_image_studio
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U smart_image_studio"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build: ./backend
    ports:
      - "8000:8000"
    volumes:
      - ./backend:/app
      - backend_venv:/app/.venv
    env_file:
      - ./backend/.env
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/health', timeout=2)"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    volumes:
      - ./frontend:/app
      - frontend_node_modules:/app/node_modules
    env_file:
      - ./frontend/.env
    depends_on:
      backend:
        condition: service_healthy

volumes:
  backend_venv:
  frontend_node_modules:
  postgres_data:
```

---

## Task 11: Update .env.example

**Files:**
- Modify: `backend/.env.example`

- [ ] **Step 1: Add DATABASE_URL to .env.example**

Add this line to `backend/.env.example`:

```
SMART_IMAGE_STUDIO_DATABASE_URL=postgresql+psycopg://smart_image_studio:smart_image_studio@localhost:5432/smart_image_studio
```

For Docker Compose, the hostname is `postgres` (the service name), not `localhost`:
```
# For Docker Compose: use @postgres:5432 instead of @localhost:5432
```

- [ ] **Step 2: Commit infrastructure files**

```bash
cd smart-image-studio && git add docker-compose.yml backend/.env.example && git commit -m "feat: add PostgreSQL service to docker-compose and document DATABASE_URL"
```

---

## Task 12: Final verification

- [ ] **Step 1: Run the full test suite**

```bash
cd backend && poetry run task test -v
```

Expected: all 106+ tests pass (new repository tests + existing integration tests).

- [ ] **Step 2: Run type check**

```bash
cd backend && poetry run task typecheck
```

Expected: `Success: no issues found`

- [ ] **Step 3: Verify local dev setup (optional — requires local PostgreSQL)**

```bash
# Start PostgreSQL locally (or via Docker)
docker run -d --name pg-dev -e POSTGRES_USER=smart_image_studio -e POSTGRES_PASSWORD=smart_image_studio -e POSTGRES_DB=smart_image_studio -p 5432:5432 postgres:16-alpine

# Run the backend
cd backend && poetry run task dev
```

Expected: server starts, logs show `INFO [alembic.runtime.migration] Running upgrade -> 0001, create jobs table`, health endpoint responds at `http://localhost:8000/health`.

- [ ] **Step 4: Final commit**

```bash
cd smart-image-studio && git add -A && git commit -m "feat: complete PostgreSQL migration — jobs persisted via SQLAlchemy + Alembic"
```
