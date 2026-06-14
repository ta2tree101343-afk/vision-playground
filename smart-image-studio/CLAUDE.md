# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Frontend (`frontend/`)

```bash
npm run dev        # dev server on :5173
npm run build      # tsc -b && vite build
npx tsc --noEmit   # type-check only (no build output)
```

### Backend (`backend/`)

```bash
poetry run task dev        # uvicorn --reload on :8000 (PYTHONPATH=src)
poetry run task format     # ruff format src/app/
poetry run task lint       # ruff check src/app/
poetry run task typecheck  # mypy src/app/
poetry run task test       # pytest (tests/ directory)
```

### Docker (recommended for full-stack)

```bash
# First time only
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

docker compose up --build   # build and start
docker compose up           # normal start
docker compose down         # stop (keep volumes)
docker compose down -v      # stop and remove volumes
```

Services: frontend `:5173`, backend `:8000`, OpenAPI docs `:8000/docs`.

---

## Architecture

### Client-side routing

`src/app/App.tsx` implements manual routing — there is no React Router. Navigation uses `window.history.pushState` via `src/shared/lib/navigation.ts:navigateTo()`, and `App` listens to `popstate`. Route definitions live in `src/app/routes.tsx`. Only two routes exist: `/` → `StudioPage`, `/result` → `ResultPage`.

### Frontend: Feature-Sliced Design (FSD)

Source lives under `frontend/src/` with six layers (import direction: app → pages → widgets → features → entities → shared):

| Layer | Path | Purpose |

|---|---|---|

| `app` | `src/app/` | Entry point, providers, routing |
| `pages` | `src/pages/studio/`, `src/pages/result/` | Full pages |
| `widgets` | `src/widgets/` | Composed UI sections (panels) |
| `features` | `src/features/` | User-facing capabilities |
| `entities` | `src/entities/` | Domain objects (image, pipeline, job) |
| `shared` | `src/shared/` | Reusable lib, UI, types, config |

TypeScript path aliases: `@app`, `@pages`, `@widgets`, `@features`, `@entities`, `@shared`.

### StudioPage hook composition

`StudioPage` composes three independent hooks. Each owns a distinct state domain:

| Hook | Location | State domain |

|---|---|---|

| `useImageFile` | `src/features/image-upload/model/` | File selection, preview URL |
| `usePipeline` | `src/features/pipeline-edit/model/` | Pipeline steps, presets, draft persistence (localStorage) |
| `useJobTracking` | `src/features/job-tracking/model/` | Async job lifecycle, polling, completion callback |

Each hook sets its own `errorMessage` string; `StudioPage` renders an `ErrorBanner` for each non-null error independently.

### Async job flow

1. `jobs.submitJob(file, ops)` → `POST /api/images/jobs` → returns `job_id`
2. `useJobTracking` polls `GET /api/images/jobs/{job_id}` every 1500 ms
3. On `status === 'completed'`: saves result to `sessionStorage` via `processResultStore`, then calls the `onCompleted` callback (configured in `StudioPage` as `() => navigateTo('/result')`)
4. `ResultPage` reads the result from `sessionStorage` on mount

The `onCompleted` callback has its own try/catch so navigation failures are reported separately from polling failures.

After a job reaches a terminal state (`completed`/`failed`), `refreshJobHistory()` re-fetches the full job list and re-selects the next `queued`/`running` job as `activeJob`. This ensures that if multiple active jobs exist (e.g., after reload or from another client session), they are processed in sequence rather than being left stale.

### Parameter unit boundary

`ParameterState` (camelCase, UI-side) and `OperationParameters` (snake_case, API-side) use different units for some fields. The conversion happens **only** in `features/pipeline-edit/lib/pipeline.ts:buildOperationStep` via `parameterBuilders`:

- `detectionThreshold`: stored as percentage `[10, 95]` in UI → divided by 100 → sent as fraction `[0.1, 0.95]`
- `blurStrength`: OpenCV `GaussianBlur` requires an **odd** kernel size. The UI enforces this via `step: 2` in `imageOperations.ts`, but values restored from localStorage bypass that constraint.
- `blurSigma`: `0` means auto-compute from kernel size on the backend.

The `operationStepToTemplate` function in `pipeline.ts` handles the reverse conversion (API `OperationStep` → UI `PipelineStepTemplate` units).

### `ImageProcessJob` discriminated union

Always narrow on `job.status` before accessing status-conditional fields:

- `'completed'` → `result: ProcessImageResponse` (guaranteed non-null by type)
- `'failed'` → `error_message: string` (guaranteed non-null by type)
- `'running'` → `started_at: string`

`normalizeProcessJob` in `src/entities/image/lib/processResult.ts` normalizes image URLs on all jobs received from the API. It includes a runtime null guard on `result` as defense against schema drift even though the TypeScript type guarantees it.

### Adding a new image operation

Five locations must be updated together:

1. `frontend/src/shared/types/api.ts` — add to `OperationType` union and `OperationParameters` interface
2. `frontend/src/features/operation-select/config/imageOperations.ts` — add `OperationOption` with UI label, icon, and `ParameterDefinition[]`
3. `frontend/src/features/pipeline-edit/lib/pipeline.ts` — add entry to `parameterBuilders` for the unit/key mapping
4. `backend/src/app/infrastructure/image_processing/opencv_processor.py` — add the raw CV operation function
5. `backend/src/app/services/image_processor.py` — add a `case` branch in `_dispatch()` that calls the new function

If the operation needs a new parameter field, also update `ParameterState` in the frontend types (the `ParameterKey` type derives automatically via `keyof ParameterState`). On the backend, add the field to `ImageOperationParameters` in `backend/src/app/schemas/image.py`.

### Backend: architecture (layered)

```text
route → controller → service → repository
service → infrastructure (OpenCV, OCR, object detection, LLM)
```

- `routes/` — HTTP method + URL binding + router aggregation (`health_route`, `image_route`, `job_route`, `router`)
- `controllers/` — parse request, call services, shape HTTP response (`image_controller`)
- `services/` — business logic (`image_processor`, `job_service`, `storage_service`, `ocr_service`, `object_detection_service`, `caption_service`)
- `repositories/` — data persistence (`job_repository` reads/writes via SQLAlchemy `Session`; `mark_interrupted_jobs()` resets in-flight rows to `failed` at startup)
- `infrastructure/` — external lib wrappers: `image_processing/opencv_processor.py`, `object_detection/mobilenet_ssd_detector.py`, `ocr/rapidocr.py`, `llm/lm_studio_client.py`, `storage/local_storage.py`, `queue/background_task_queue.py`
- `dependencies/service_dependency.py` — `@lru_cache` singleton factories (`get_job_service()`, `get_image_processor()`, etc.)
- `validators/` — request-level validation shared across controllers
- `utils/annotation_util.py` — shared label-drawing helper for OCR and object detection overlays
- `utils/image_util.py` — `build_asset_url` and `build_process_response` (shared by `image_controller` and `job_service`)

### Backend: job persistence

Jobs are persisted in **PostgreSQL** via SQLAlchemy (Alembic migrations under `backend/alembic/`). The model uses `JSONB` columns, so PostgreSQL is required — SQLite is not supported. The `DATABASE_URL` env var points to the DB; Docker Compose wires PostgreSQL automatically.

`JobService` keeps ephemeral in-process dicts (`_payloads`, `_queue_order`) for the active queue — these are lost on restart. `mark_interrupted_jobs()` resets any `queued`/`running` DB rows to `failed` at startup to recover from crashes. The job queue singleton is created in `dependencies/service_dependency.py:get_job_service()` and is shut down gracefully via the `lifespan` handler in `main.py`.

`JobRepository.update()` auto-fills required timestamps on status transitions: `started_at` is set when transitioning to `running`/`completed`/`failed` (if not already set), and `completed_at` is set when transitioning to `completed`/`failed` (if not already set). Callers may still pass explicit values, which take precedence.

### Storage and sessionStorage safety

`sessionStorage` access for the latest process result lives in `src/entities/job/lib/processResultStore.ts`. Reads, writes, and removals are wrapped in try/catch blocks to handle `SecurityError` in private browsing mode. Storage is obtained via `getSessionStorage()` from `src/shared/lib/browser.ts`, which returns `null` in SSR environments.

## 開発ワークフロー

- **新しいコードを実装したら必ずコードレビューを実施する**
  - 実装完了後、`feature-dev:code-reviewer` エージェントでレビューを行う
  - バグ・ロジック誤り・規約違反・テスト漏れを確認する
  - レビューで指摘された問題はすべて修正してから次のタスクに進む
