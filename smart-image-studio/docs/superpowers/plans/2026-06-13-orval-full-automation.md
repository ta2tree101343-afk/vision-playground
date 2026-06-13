# Orval Full Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all hand-written type/schema definitions and HTTP calls in `jobApi.ts` with Orval-generated code by fixing the backend OpenAPI representation and introducing a custom fetch mutator.

**Architecture:** Two backend Pydantic fixes remove the two reasons `shared/types/api.ts` stays hand-written today — (1) `model_serializer` on `ImageOperationParameters` collapses its fields to `{ [key: string]: unknown }` in OpenAPI; (2) `ImageProcessJob` is flat so Orval cannot derive a discriminated union. After regeneration, a custom `mutator.ts` bridges Orval-generated fetch functions with `apiClient`'s error-handling logic, and `jobApi.ts` shrinks to a thin wrapper (`parseJob` + 3 re-exports).

**Tech Stack:** FastAPI + Pydantic v2 (discriminated unions), Orval v8.17, Zod v4, native fetch (no axios), taskipy

---

## File Map

| File | Action | Reason |
|---|---|---|
| `backend/src/app/schemas/image.py` | MODIFY | Remove `model_serializer` so OpenAPI exposes typed `ImageOperationParameters` fields |
| `backend/src/app/schemas/job_response.py` | CREATE | Discriminated union response models per status |
| `backend/src/app/routes/job_route.py` | MODIFY | Use `ImageProcessJobResponse` as `response_model` |
| `docs/openapi.json` | REGENERATE | Reflects both backend fixes |
| `frontend/src/shared/api/__generated__/api.types.ts` | REGENERATE | Typed parameters + discriminated union |
| `frontend/src/shared/api/__generated__/api.schemas.ts` | REGENERATE | Zod discriminated union for `ImageProcessJobResponse` |
| `frontend/src/shared/types/api.ts` | MODIFY | Remove hand-written OperationParameters, OperationStep, ImageProcessJob — use generated |
| `frontend/src/shared/api/mutator.ts` | CREATE | Custom fetch replacing `apiClient.request()` in generated functions |
| `frontend/orval.config.ts` | MODIFY | Wire mutator to `apiTypes` output |
| `frontend/src/shared/api/__generated__/api.types.ts` | REGENERATE again | Generated functions now call `customFetch` |
| `frontend/src/shared/api/jobApi.ts` | MODIFY | Use generated fetch functions; drop direct `apiClient.request()` calls |

---

## Task 1: Remove `model_serializer` from `ImageOperationParameters`

**Files:**
- Modify: `backend/src/app/schemas/image.py`

`model_serializer(mode="wrap")` makes Pydantic report the return type as `dict[str, Any]` in OpenAPI, causing Orval to generate `{ [key: string]: unknown }`. Removing it means null fields are sent in responses — which is fine, no consumer breaks on extra null fields.

- [ ] Replace the entire `ImageOperationParameters` class:

```python
# backend/src/app/schemas/image.py
# Replace the class definition (leave OperationType, ImageOperationStep, etc. unchanged)

class ImageOperationParameters(BaseModel):
    model_config = ConfigDict(extra="forbid")

    blur_strength: int | None = Field(default=None, ge=1, le=25)
    blur_sigma: float | None = Field(default=None, ge=0.0, le=10.0)
    brightness: int | None = Field(default=None, ge=-100, le=100)
    contrast: int | None = Field(default=None, ge=-100, le=100)
    sharpen_strength: int | None = Field(default=None, ge=1, le=5)
    denoise_strength: int | None = Field(default=None, ge=1, le=30)
    detection_threshold: float | None = Field(default=None, ge=0.1, le=0.95)

    @field_validator("blur_strength")
    @classmethod
    def blur_strength_must_be_odd(cls, v: int | None) -> int | None:
        if v is not None and v % 2 == 0:
            raise ValueError("blur_strength は奇数である必要があります（OpenCV GaussianBlur の要件）。")
        return v
```

- [ ] Update the import line at the top of `schemas/image.py`. Remove `model_serializer` and `Any`:

```python
from typing import Any  # DELETE this line
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_serializer, model_validator
# becomes:
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
```

- [ ] Run backend tests:

```bash
cd smart-image-studio/backend && poetry run task test
```

Expected: all tests pass. `test_schemas.py` does not check serialized output format, only validation behavior.

- [ ] Commit:

```bash
git add smart-image-studio/backend/src/app/schemas/image.py
git commit -m "fix: remove model_serializer from ImageOperationParameters to expose typed fields in OpenAPI"
```

---

## Task 2: Create discriminated union response models

**Files:**
- Create: `backend/src/app/schemas/job_response.py`

`ImageProcessJob` is flat internally (needed by the service/repository layer). We add separate response-only models for each status variant and expose them as a discriminated union in the API. The internal flat model and its validators are **not touched**.

FastAPI with Pydantic v2 serializes a return value of `ImageProcessJob` against `response_model=ImageProcessJobResponse` via `TypeAdapter.validate_python(job, from_attributes=True)`. Pydantic reads `job.status` to select the correct variant, then validates the remaining fields.

- [ ] Create `backend/src/app/schemas/job_response.py`:

```python
from datetime import datetime
from typing import Annotated, Literal, Union

from pydantic import BaseModel, Field

from app.schemas.image import ImageOperationStep, ProcessImageResponse


class _JobBase(BaseModel):
    job_id: str
    progress: int = Field(ge=0, le=100)
    message: str
    filename: str
    created_at: datetime
    applied_operations: list[ImageOperationStep]


class QueuedJobResponse(_JobBase):
    status: Literal["queued"]
    queue_position: int | None = Field(default=None, ge=1)
    started_at: None = None
    completed_at: None = None
    result: None = None
    error_message: None = None


class RunningJobResponse(_JobBase):
    status: Literal["running"]
    started_at: datetime
    queue_position: None = None
    completed_at: None = None
    result: None = None
    error_message: None = None


class CompletedJobResponse(_JobBase):
    status: Literal["completed"]
    started_at: datetime
    completed_at: datetime
    result: ProcessImageResponse
    queue_position: None = None
    error_message: None = None


class FailedJobResponse(_JobBase):
    status: Literal["failed"]
    started_at: datetime
    completed_at: datetime
    error_message: str
    queue_position: None = None
    result: None = None


ImageProcessJobResponse = Annotated[
    Union[QueuedJobResponse, RunningJobResponse, CompletedJobResponse, FailedJobResponse],
    Field(discriminator="status"),
]
```

- [ ] Write a quick validation smoke test at the bottom of `tests/unit/test_schemas.py`:

```python
def test_job_response_discriminated_union_queued() -> None:
    from app.schemas.job_response import ImageProcessJobResponse
    from pydantic import TypeAdapter
    adapter = TypeAdapter(ImageProcessJobResponse)
    job = adapter.validate_python({
        "job_id": "x", "status": "queued", "progress": 0,
        "message": "", "filename": "f.png", "created_at": _NOW,
        "applied_operations": [],
    })
    assert job.status == "queued"


def test_job_response_discriminated_union_completed() -> None:
    from app.schemas.image import ProcessImageResponse
    from app.schemas.job_response import ImageProcessJobResponse
    from pydantic import TypeAdapter
    adapter = TypeAdapter(ImageProcessJobResponse)
    result = ProcessImageResponse(
        message="ok", original_image_url="/o", processed_image_url="/p",
        processed_filename="out.png", applied_operations=[],
    )
    job = adapter.validate_python({
        "job_id": "x", "status": "completed", "progress": 100,
        "message": "", "filename": "f.png", "created_at": _NOW,
        "started_at": _NOW, "completed_at": _LATER,
        "applied_operations": [], "result": result.model_dump(mode="json"),
    })
    assert job.status == "completed"
    assert job.result.message == "ok"
```

- [ ] Run tests to verify new tests pass:

```bash
cd smart-image-studio/backend && poetry run task test tests/unit/test_schemas.py -v
```

Expected: all pass including 2 new tests.

- [ ] Commit:

```bash
git add smart-image-studio/backend/src/app/schemas/job_response.py \
        smart-image-studio/backend/tests/unit/test_schemas.py
git commit -m "feat: add discriminated union response models for ImageProcessJob"
```

---

## Task 3: Update routes to use `ImageProcessJobResponse`

**Files:**
- Modify: `backend/src/app/routes/job_route.py`

Change `response_model` from `ImageProcessJob` to `ImageProcessJobResponse` for all 3 job endpoints. The controllers and services return the internal flat `ImageProcessJob` — FastAPI handles the serialization.

- [ ] Replace the entire `job_route.py`:

```python
from fastapi import APIRouter, Depends, File, Form, Request, UploadFile, status

from app.controllers.job_controller import JobController
from app.dependencies.service_dependency import get_job_controller
from app.schemas.job import ImageProcessJob
from app.schemas.job_response import ImageProcessJobResponse
from app.validators.image_validator import read_and_validate_image

router = APIRouter()


@router.post(
    "/jobs",
    response_model=ImageProcessJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="ジョブを作成",
    description="""\
画像処理ジョブをキューに登録し、非同期で処理を開始します。

ジョブ ID を使って `GET /jobs/{job_id}` でステータスをポーリングしてください。
""",
    response_description="作成されたジョブの初期状態（status: queued）",
    responses={
        status.HTTP_400_BAD_REQUEST: {
            "description": "ファイル名が不正、ファイルが空、画像として認識できない、または operations のバリデーションエラー"
        },
        status.HTTP_413_CONTENT_TOO_LARGE: {"description": "ファイルサイズが 20 MB を超えているか、画素数が上限を超えています"},
        status.HTTP_503_SERVICE_UNAVAILABLE: {"description": "ジョブキューが満杯です。しばらく後に再試行してください"},
    },
)
async def create_process_job(
    request: Request,
    file: UploadFile = File(...),
    operations: str = Form(...),
    controller: JobController = Depends(get_job_controller),
) -> ImageProcessJob:
    image_bytes = await read_and_validate_image(file)
    return await controller.create_job(
        request=request,
        image_bytes=image_bytes,
        filename=file.filename or "upload.png",
        operations=operations,
    )


@router.get(
    "/jobs",
    response_model=list[ImageProcessJobResponse],
    summary="ジョブ一覧を取得",
    description="最近のジョブを作成日時の降順で返します。",
    response_description="ジョブの一覧（新しい順）",
    responses={},
)
def list_process_jobs(controller: JobController = Depends(get_job_controller)) -> list[ImageProcessJob]:
    return controller.list_jobs()


@router.get(
    "/jobs/{job_id}",
    response_model=ImageProcessJobResponse,
    summary="ジョブを取得",
    description="指定した `job_id` のジョブ詳細を返します。",
    response_description="指定ジョブの現在の状態",
    responses={
        status.HTTP_404_NOT_FOUND: {"description": "指定されたジョブが見つかりません"},
    },
)
def get_process_job(job_id: str, controller: JobController = Depends(get_job_controller)) -> ImageProcessJob:
    return controller.get_job(job_id)
```

- [ ] Run the full backend test suite:

```bash
cd smart-image-studio/backend && poetry run task test
```

Expected: all pass. Integration tests check `body["status"] == "queued"` and `"job_id" in body` — both still present.

- [ ] Commit:

```bash
git add smart-image-studio/backend/src/app/routes/job_route.py
git commit -m "feat: use ImageProcessJobResponse as route response_model for discriminated OpenAPI output"
```

---

## Task 4: Re-export OpenAPI and regenerate, inspect output

**Files:**
- Regenerate: `docs/openapi.json`
- Regenerate: `frontend/src/shared/api/__generated__/api.types.ts`
- Regenerate: `frontend/src/shared/api/__generated__/api.schemas.ts`

- [ ] Re-export the OpenAPI spec:

```bash
cd smart-image-studio/backend && poetry run task export-openapi
```

- [ ] Verify the spec now contains discriminated union and typed parameters:

```bash
# Should show "discriminator" and "mapping"
python -m json.tool smart-image-studio/docs/openapi.json | grep -A10 '"discriminator"' | head -20

# Should show typed fields, NOT { "additionalProperties": {} }
python -m json.tool smart-image-studio/docs/openapi.json | grep -A20 '"ImageOperationParameters"' | head -25

# Should show oneOf with 4 variants
python -m json.tool smart-image-studio/docs/openapi.json | grep -A5 '"ImageProcessJobResponse"' | head -10
```

Expected:
- `"discriminator": { "propertyName": "status", "mapping": {...} }` — present
- `"ImageOperationParameters"` has `"properties": { "blur_strength": {...}, "brightness": {...}, ... }` — NOT `"additionalProperties": {}`
- `"ImageProcessJobResponse"` has `"oneOf"` or `"anyOf"` with 4 `$ref` entries

- [ ] Run Orval codegen:

```bash
cd smart-image-studio/frontend && npm run codegen
```

- [ ] **Inspect `api.types.ts`**: Check the generated names for the types you will use in Tasks 5 and 8.

Open `frontend/src/shared/api/__generated__/api.types.ts` and note:

| What to look for | Expected generated name | Actual name |
|---|---|---|
| Typed parameters interface | `ImageOperationParameters` | _____________ |
| Operation step with typed parameters | `ImageOperationStep` | _____________ |
| Discriminated union for job response | `ImageProcessJobResponse` | _____________ |
| Individual variant (queued) | `QueuedJobResponse` | _____________ |

Verify `ImageOperationParameters` has properties (`blur_strength`, `brightness`, etc.) instead of `{ [key: string]: unknown }`.

Verify `ImageProcessJobResponse` is a union type with `status` discrimination.

- [ ] **Inspect `api.schemas.ts`**: Note the Zod schema name for the job response.

Open `frontend/src/shared/api/__generated__/api.schemas.ts` and find:
- `ImageProcessJobResponse` — should be `z.discriminatedUnion('status', [...])`
- `ImageOperationParameters` — should have `.min()/.max()` number constraints

- [ ] Commit the regenerated files:

```bash
git add smart-image-studio/docs/openapi.json \
        smart-image-studio/frontend/src/shared/api/__generated__/
git commit -m "chore: regenerate orval output after backend openapi fixes"
```

---

## Task 5: Simplify frontend adapter `shared/types/api.ts`

**Files:**
- Modify: `frontend/src/shared/types/api.ts`

After Task 4, Orval generates accurate types for `ImageOperationParameters`, `ImageOperationStep`, and `ImageProcessJobResponse` (discriminated union). The hand-written versions in the adapter are now redundant.

**Use the actual generated names you noted in Task 4.**

If Orval generated different names than expected, substitute those names below.

- [ ] Replace the entire content of `frontend/src/shared/types/api.ts`:

```ts
// Adapter over Orval-generated types.
// - Aliases generated names to the frontend names used throughout the codebase.
// - Keeps HealthResponse, ApiValidationErrorDetail, ApiErrorBody hand-written
//   (generated names and shapes differ from what apiClient.ts uses).
// - Keeps ProcessImageRequest hand-written (form upload — not an OpenAPI schema component).
export type {
  OperationType,
  ProcessImageResponse,
  BoundingBox,
  OcrLine,
  OcrResult,
  DetectedObject,
  ObjectDetectionResult,
  BackgroundRemovalResult,
  CaptionCandidate,
  CaptionResult,
  ImageAnalysisResult,
} from '@shared/api/__generated__/api.types';

// Aliases: backend model names → shorter frontend names
export type { ImageOperationParameters as OperationParameters } from '@shared/api/__generated__/api.types';
export type { ImageOperationStep as OperationStep } from '@shared/api/__generated__/api.types';
export type { ImageProcessJobResponse as ImageProcessJob } from '@shared/api/__generated__/api.types';

// Local imports for use within this file (re-exports above cover consumers)
import type { ImageOperationStep as OperationStep } from '@shared/api/__generated__/api.types';
import type { ImageProcessJobResponse as ImageProcessJob } from '@shared/api/__generated__/api.types';

// Hand-written: form upload type — not an OpenAPI schema component
export interface ProcessImageRequest {
  file: File;
  operations: OperationStep[];
}

// Hand-written: generated HealthCheckResponse has { status: 'ok' } (literal);
// apiClient.ts uses { status: string } (wider type for future-proofing).
export interface HealthResponse {
  status: string;
}

// Hand-written: generated HTTPValidationError.detail is ValidationError[] only (no string branch).
// apiClient.ts uses the string branch for non-validation error responses.
export interface ApiValidationErrorDetail {
  loc?: Array<string | number>;
  msg?: string;
  type?: string;
}

export interface ApiErrorBody {
  detail?: string | ApiValidationErrorDetail[];
}

// Derived from the generated discriminated union.
export type JobStatus = ImageProcessJob['status'];
```

- [ ] Run type check:

```bash
cd smart-image-studio/frontend && npx tsc --noEmit
```

Expected: no errors. If there are errors about `OperationStep` not having expected properties (because Orval generated slightly different field names), open `api.types.ts` and check the exact field names and adjust the test files accordingly.

- [ ] Run build:

```bash
npm run build
```

Expected: builds successfully.

- [ ] Commit:

```bash
git add smart-image-studio/frontend/src/shared/types/api.ts
git commit -m "chore: simplify types/api.ts adapter now that orval generates accurate types"
```

---

## Task 6: Create custom fetch mutator

**Files:**
- Create: `frontend/src/shared/api/mutator.ts`

The mutator replaces the native `fetch` call inside Orval-generated functions. It prepends the base URL, handles errors with Japanese messages, and throws `ApiError` (imported from `apiClient.ts`) on non-OK responses.

`apiClient.ts` is NOT deleted — it still provides the `ApiError` class and the `download` method used elsewhere.

- [ ] Create `frontend/src/shared/api/mutator.ts`:

```ts
import { env } from '@shared/config/env';
import { ApiError } from '@shared/api/apiClient';

const BASE_URL = env.apiBaseUrl.replace(/\/$/, '');

function buildFullUrl(url: string): string {
  if (/^https?:\/\//.test(url)) return url;
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${BASE_URL}${path}`;
}

async function parseResponsePayload(response: Response): Promise<unknown> {
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text.trim()) return null;
  const ct = response.headers.get('content-type') ?? '';
  return ct.includes('application/json') || ct.includes('+json')
    ? (JSON.parse(text) as unknown)
    : text;
}

function toErrorMessage(status: number, payload: unknown): string {
  if (typeof payload === 'string' && payload.trim()) return payload;
  if (payload && typeof payload === 'object') {
    const detail = (payload as { detail?: unknown }).detail;
    if (typeof detail === 'string' && detail.trim()) return detail;
    if (Array.isArray(detail)) {
      const msgs = detail
        .map((d: unknown) =>
          d && typeof d === 'object' && 'msg' in d ? (d as { msg?: unknown }).msg : null,
        )
        .filter((m): m is string => typeof m === 'string');
      if (msgs.length) return msgs.join(' / ');
    }
  }
  return `API に接続できませんでした（status: ${status}）。`;
}

export const customFetch = async <T>(url: string, options: RequestInit): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(buildFullUrl(url), options);
  } catch (error) {
    throw new ApiError(
      `API に接続できませんでした。backend が起動しているか、接続先 ${BASE_URL} が正しいか確認してください。`,
      0,
      error,
    );
  }

  let payload: unknown;
  try {
    payload = await parseResponsePayload(response);
  } catch (error) {
    throw new ApiError(
      `サーバーのレスポンスを解析できませんでした（status: ${response.status}）。`,
      response.status,
      error,
    );
  }

  if (!response.ok) {
    throw new ApiError(toErrorMessage(response.status, payload), response.status, payload);
  }

  return payload as T;
};
```

- [ ] Run type check to verify `mutator.ts` is type-clean:

```bash
cd smart-image-studio/frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] Commit:

```bash
git add smart-image-studio/frontend/src/shared/api/mutator.ts
git commit -m "feat: add custom fetch mutator for orval-generated API functions"
```

---

## Task 7: Wire mutator in `orval.config.ts` and regenerate

**Files:**
- Modify: `frontend/orval.config.ts`
- Regenerate: `frontend/src/shared/api/__generated__/api.types.ts`

- [ ] Update `frontend/orval.config.ts` to add the mutator:

```ts
import { defineConfig } from 'orval';

export default defineConfig({
  apiTypes: {
    input: '../docs/openapi.json',
    output: {
      mode: 'single',
      target: './src/shared/api/__generated__/api.types.ts',
      // 'fetch' avoids an axios dependency. Orval always generates fetch wrapper functions
      // alongside types — there is no types-only mode. The generated functions are used
      // in jobApi.ts via the customFetch mutator below.
      client: 'fetch',
      override: {
        useTypeOverInterfaces: true,
        mutator: {
          path: './src/shared/api/mutator.ts',
          name: 'customFetch',
        },
      },
    },
  },
  apiSchemas: {
    input: '../docs/openapi.json',
    output: {
      mode: 'single',
      target: './src/shared/api/__generated__/api.schemas.ts',
      client: 'zod',
      override: {
        zod: {
          generateReusableSchemas: true,
        },
      },
    },
  },
});
```

- [ ] Regenerate:

```bash
cd smart-image-studio/frontend && npm run codegen
```

- [ ] **Inspect the regenerated `api.types.ts`**: Find the generated function names for the 3 job endpoints. Look for functions named `createProcess...`, `listProcess...`, `getProcessJob...`. Note the exact exported function names — you will need them in Task 8.

```bash
grep "^export const " smart-image-studio/frontend/src/shared/api/__generated__/api.types.ts | grep -i "job"
```

Note the names:
- POST /api/images/jobs: `________________________`
- GET /api/images/jobs: `________________________`
- GET /api/images/jobs/{job_id}: `________________________`

Also verify:
```bash
grep "customFetch" smart-image-studio/frontend/src/shared/api/__generated__/api.types.ts | head -5
```

Expected: `customFetch` appears — confirms the mutator is wired.

- [ ] Run type check:

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] Commit:

```bash
git add smart-image-studio/frontend/orval.config.ts \
        smart-image-studio/frontend/src/shared/api/__generated__/api.types.ts
git commit -m "chore: wire custom fetch mutator into orval config and regenerate"
```

---

## Task 8: Slim down `jobApi.ts` to use generated functions

**Files:**
- Modify: `frontend/src/shared/api/jobApi.ts`

Replace direct `apiClient.request()` calls with the generated API functions noted in Task 7. `parseJob` (Zod validation + URL normalization) stays as the boundary guard.

**Use the exact function names you noted in Task 7.** The example below uses the expected names — adjust if Orval generated different names.

- [ ] Replace `frontend/src/shared/api/jobApi.ts`:

```ts
import type { ImageProcessJob, ProcessImageRequest } from '@shared/types/api';
import {
  createProcessJobApiImagesJobsPost,
  listProcessJobsApiImagesJobsGet,
  getProcessJobApiImagesJobsJobIdGet,
} from '@shared/api/__generated__/api.types';
import { ImageProcessJobResponse as imageProcessJobSchema } from '@shared/api/__generated__/api.schemas';
import { normalizeProcessJob } from '@shared/lib/processResult';

function parseJob(raw: unknown): ImageProcessJob {
  return normalizeProcessJob(imageProcessJobSchema.parse(raw) as unknown as ImageProcessJob);
}

export async function createProcessJob(payload: ProcessImageRequest): Promise<ImageProcessJob> {
  if (payload.operations.length === 0) {
    throw new Error('画像処理には 1 つ以上の operation が必要です。');
  }
  const raw = await createProcessJobApiImagesJobsPost({
    file: payload.file,
    operations: JSON.stringify(payload.operations),
  });
  return parseJob(raw);
}

export async function fetchProcessJob(jobId: string): Promise<ImageProcessJob> {
  const raw = await getProcessJobApiImagesJobsJobIdGet(jobId, {
    signal: AbortSignal.timeout(10_000),
  });
  return parseJob(raw);
}

export async function fetchProcessJobs(): Promise<ImageProcessJob[]> {
  const raw = await listProcessJobsApiImagesJobsGet({ signal: AbortSignal.timeout(10_000) });
  return (Array.isArray(raw) ? raw : []).map(parseJob);
}
```

**Note on `parseJob` cast:** `imageProcessJobSchema.parse(raw)` returns `z.infer<typeof ImageProcessJobResponse>`. If TypeScript accepts assignment to `ImageProcessJob` without the `as unknown as ImageProcessJob` cast (the structures are identical after the backend fix), remove the cast. If it errors, keep the cast.

- [ ] Run type check:

```bash
cd smart-image-studio/frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] Run build:

```bash
npm run build
```

Expected: builds successfully.

- [ ] Commit:

```bash
git add smart-image-studio/frontend/src/shared/api/jobApi.ts
git commit -m "refactor: slim down jobApi.ts to use orval-generated fetch functions via custom mutator"
```

---

## Task 9: Final verification

- [ ] Run backend tests:

```bash
cd smart-image-studio/backend && poetry run task test
```

Expected: all pass.

- [ ] Run frontend build:

```bash
cd smart-image-studio/frontend && npm run build
```

Expected: builds with no errors.

- [ ] Simulate CI (regenerate and check for diff):

```bash
cd smart-image-studio/backend && poetry run task export-openapi
cd smart-image-studio/frontend && npm run codegen
git diff --exit-code smart-image-studio/docs/openapi.json smart-image-studio/frontend/src/shared/api/__generated__/
```

Expected: no diff. If there is a diff, the export or codegen is non-deterministic — investigate before proceeding.

- [ ] Start dev server and verify the UI loads:

```bash
cd smart-image-studio/frontend && npm run dev
```

Open `http://localhost:5173` (or whichever port Vite picks). Verify:
- Studio page loads without JS errors related to imports
- Pipeline editor renders
- The only console errors are CORS/connection errors to `localhost:8000` (expected — backend not running)

---

## Known trade-offs (accepted)

| Item | Before | After | Impact |
|---|---|---|---|
| `null` fields in `ImageOperationParameters` response | Excluded by `model_serializer` | Included (e.g., `blur_strength: null`) | Larger response payload; consumers ignore null fields |
| Internal `ImageProcessJob` vs response `ImageProcessJobResponse` | One model | Two model layers | Small duplication; clean API/internal separation |
| `as unknown as ImageProcessJob` cast in `parseJob` | Present | May still be needed | Type-safe at runtime via Zod; cast is structural, not semantic |
| Generated function names are verbose | N/A | `createProcessJobApiImagesJobsPost` etc. | Wrapped by thin `jobApi.ts` aliases — not visible to callers |
