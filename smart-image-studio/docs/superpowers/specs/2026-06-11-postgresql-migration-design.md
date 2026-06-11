# PostgreSQL Migration Design

**Date:** 2026-06-11  
**Scope:** Replace in-memory + JSON file job persistence with PostgreSQL via SQLAlchemy 2.x (sync) + Alembic

---

## Decisions

| Question | Decision |
|---|---|
| Migration management | Alembic (versioned migrations) |
| SQLAlchemy session style | Sync (`Session`) |
| Test DB strategy | `testcontainers[postgres]` — real PostgreSQL per test suite, per-test SAVEPOINT rollback |

---

## Architecture

### Approach

Swap the `JobRepository` implementation from in-memory + JSON file to SQLAlchemy. The public interface (`save`, `find`, `list_recent`, `remove`) is unchanged, so `JobService`, controllers, and routes require no modification.

ORM model (`JobModel`) and Pydantic schema (`ImageProcessJob`) remain separate classes. Conversion functions `_to_domain()` / `_from_domain()` bridge them inside `job_repository.py`.

### New Files

```
backend/
  src/app/
    db/
      __init__.py
      engine.py              # create_engine + SessionLocal factory
      models/
        __init__.py
        job_model.py         # SQLAlchemy ORM mapped class (JobModel)
  alembic/
    env.py
    versions/
      0001_create_jobs_table.py
  alembic.ini
```

### Changed Files

| File | Change |
|---|---|
| `src/app/repositories/job_repository.py` | Full rewrite — SQLAlchemy Session replacing in-memory dict + JSON |
| `src/app/dependencies/service_dependency.py` | `get_job_repository()` injects `SessionLocal` instead of a file path |
| `src/app/main.py` | `lifespan` runs `alembic upgrade head` via `asyncio.to_thread` on startup |
| `docker-compose.yml` | Add `postgres` service; `backend` depends on it with healthcheck |
| `backend/.env.example` | Add `SMART_IMAGE_STUDIO_DATABASE_URL` |
| `pyproject.toml` | Add `alembic`, `testcontainers[postgres]` (dev dep) |
| `tests/conftest.py` | Add `postgres_url`, `db_engine`, `db_session` fixtures |

### Deleted

- `_save_history`, `_load_history`, `_jobs` dict, `JOB_HISTORY_LIMIT` file-persistence logic from `job_repository.py`
- `history.json` file (and the directory creation for it)

---

## DB Schema

Table: `jobs`

| Column | Type | Constraints |
|---|---|---|
| `job_id` | `TEXT` | PRIMARY KEY |
| `status` | `VARCHAR(16)` | NOT NULL, CHECK IN ('queued','running','completed','failed') |
| `progress` | `INTEGER` | NOT NULL DEFAULT 0 |
| `message` | `TEXT` | NOT NULL DEFAULT '' |
| `filename` | `TEXT` | NOT NULL |
| `created_at` | `TIMESTAMPTZ` | NOT NULL |
| `started_at` | `TIMESTAMPTZ` | nullable |
| `completed_at` | `TIMESTAMPTZ` | nullable |
| `applied_operations` | `JSONB` | NOT NULL DEFAULT '[]' |
| `result` | `JSONB` | nullable — non-null only on `completed` |
| `error_message` | `TEXT` | nullable — non-null only on `failed` |

Index: `ix_jobs_created_at ON jobs (created_at DESC)` — used by `list_recent` ORDER BY.

`queue_position` is a transient computed value; not stored.

`result` stores the full `ProcessImageResponse` JSON (including nested `analysis`). No separate analysis table.

---

## Repository Implementation

```python
class JobRepository:
    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self._session_factory = session_factory

    def find(self, job_id: str) -> ImageProcessJob | None:
        with self._session_factory() as session:
            row = session.get(JobModel, job_id)
            return _to_domain(row) if row else None

    def save(self, job: ImageProcessJob, *, persist: bool = True) -> None:
        # persist flag accepted for interface compatibility; always writes to DB
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
```

`session.merge()` performs INSERT-or-UPDATE based on primary key — equivalent to the old dict upsert.

The `persist=False` path (previously used for in-flight progress updates to avoid disk I/O) now always writes. The flag is kept for interface compatibility and can be removed in a follow-up PR.

---

## Session Management

`engine.py` creates a single `Engine` and `SessionLocal` factory at module load:

```python
engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(engine)
```

`pool_pre_ping=True` automatically validates connections on checkout, recovering from DB restarts without application error.

`service_dependency.py`:
```python
@lru_cache
def get_job_repository() -> JobRepository:
    from app.db.engine import SessionLocal
    return JobRepository(SessionLocal)
```

---

## Startup Migration

`main.py` lifespan runs migrations before accepting traffic:

```python
@asynccontextmanager
async def lifespan(_app: FastAPI):
    await asyncio.to_thread(_run_alembic_upgrade)
    yield
    await get_job_service().shutdown()
```

`_run_alembic_upgrade(url: str | None = None)` calls Alembic's programmatic API (`Config` + `command.upgrade`). When `url` is `None` (production), it uses `settings.database_url` via `alembic.ini`; when provided (tests), it overrides the URL in the Alembic `Config` before running. Idempotent — Alembic skips already-applied migrations.

---

## Infrastructure

### docker-compose.yml additions

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
    depends_on:
      postgres:
        condition: service_healthy

volumes:
  postgres_data:
```

### .env.example addition

```
SMART_IMAGE_STUDIO_DATABASE_URL=postgresql+psycopg://smart_image_studio:smart_image_studio@localhost:5432/smart_image_studio
```

The `+psycopg` suffix selects the psycopg3 SQLAlchemy dialect (already in `pyproject.toml`).

---

## Testing Strategy

### Fixtures (conftest.py)

```python
@pytest.fixture(scope="session")
def postgres_url() -> Generator[str, None, None]:
    with PostgresContainer("postgres:16-alpine") as pg:
        yield pg.get_connection_url(driver="psycopg")

@pytest.fixture(scope="session")
def db_engine(postgres_url: str) -> Generator[Engine, None, None]:
    engine = create_engine(postgres_url)
    _run_alembic_upgrade(url=postgres_url)   # applies migrations to test DB
    yield engine
    engine.dispose()

@pytest.fixture
def db_session(db_engine: Engine) -> Generator[Session, None, None]:
    with db_engine.connect() as conn:
        conn.begin_nested()        # SAVEPOINT
        with Session(bind=conn) as session:
            yield session
        conn.rollback()            # rollback to SAVEPOINT → clean slate per test
```

- Container starts **once per test suite session** — startup cost paid once
- Each test rolls back via SAVEPOINT — no test isolation issues, no truncation overhead
- `client` fixture passes `postgres_url` via `monkeypatch.setenv("SMART_IMAGE_STUDIO_DATABASE_URL", ...)`

### Affected test files

| File | Change |
|---|---|
| `tests/unit/test_job_repository.py` | Full rewrite — use `db_session` fixture, remove JSON file assertions |
| `tests/integration/test_job_api.py` | Add `db_engine` to `client` fixture dependency |
| `tests/integration/test_image_api.py` | Same as above |

---

## Error Handling

- DB connection failure at startup → `alembic upgrade head` raises → uvicorn process exits with non-zero code → Docker restarts the container (standard crash-loop behavior)
- `session.merge()` / `session.commit()` failure → `SQLAlchemyError` propagates up through `JobService` → caught as unexpected exception → job marked `FAILED`, error logged
- `pool_pre_ping=True` handles transient connection drops transparently

---

## Out of Scope

- Multiple replicas / horizontal scaling (would require `SELECT FOR UPDATE` for status transitions)
- Removing the `persist` flag from `JobService._update_job` (follow-up PR)
- Archiving or purging old jobs from the DB (the 100-job limit from the JSON era is removed; jobs accumulate indefinitely)
