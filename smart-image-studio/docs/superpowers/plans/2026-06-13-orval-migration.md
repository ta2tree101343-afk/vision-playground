# Orval Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hand-written TypeScript types and Zod schemas with Orval-generated code from the FastAPI OpenAPI spec.

**Architecture:** FastAPI's `/openapi.json` is exported to `docs/openapi.json` (static file, committed to repo). Orval reads this and generates `__generated__/api.types.ts` (TypeScript interfaces) and `__generated__/api.schemas.ts` (Zod schemas). Two complications are handled in `shared/types/api.ts`, which is kept as an adapter layer rather than deleted: (1) the backend `ImageProcessJob` is a flat Pydantic model so Orval cannot derive the discriminated union the frontend relies on; (2) Pydantic model names differ from frontend type names (e.g. `ImageOperationStep` vs `OperationStep`) and are aliased here. Only the 3 files importing `@shared/schemas/api.schemas` need import path updates — the 19 files importing `@shared/types/api` need no changes because `shared/types/api.ts` is kept.

**Tech Stack:** Orval (latest), Zod 4 (already installed), FastAPI + taskipy (already installed)

---

## File Map

| File | Action | Reason |
|---|---|---|
| `backend/scripts/export_openapi.py` | CREATE | Exports spec with consistent UTF-8 + LF |
| `backend/pyproject.toml` | MODIFY | Add `export-openapi` taskipy task |
| `docs/openapi.json` | CREATE (generated, committed) | Static spec as single source of truth |
| `frontend/package.json` | MODIFY | Add `orval` devDep + `codegen` script |
| `frontend/orval.config.ts` | CREATE | Orval configuration |
| `frontend/src/shared/api/__generated__/api.types.ts` | GENERATED | Raw TypeScript types from OpenAPI |
| `frontend/src/shared/api/__generated__/api.schemas.ts` | GENERATED | Zod schemas from OpenAPI |
| `frontend/src/shared/types/api.ts` | MODIFY (not delete) | Adapter: re-exports generated types with name aliases; overrides `ImageProcessJob` with discriminated union; keeps `ProcessImageRequest` hand-written |
| `frontend/src/shared/schemas/api.schemas.ts` | DELETE | Fully replaced by generated file |
| `frontend/src/shared/api/jobApi.ts` | MODIFY | Schema import path: `@shared/schemas/api.schemas` → `__generated__` |
| `frontend/src/entities/job/lib/processResultStore.ts` | MODIFY | Schema import path: `@shared/schemas/api.schemas` → `__generated__` |
| `frontend/src/features/pipeline-edit/lib/pipelineStorage.ts` | MODIFY | Schema import path: `@shared/schemas/api.schemas` → `__generated__` |
| `.github/workflows/check-generated.yml` | CREATE | CI guard against stale generated files |

---

## Task 1: Backend — OpenAPI export script

**Files:**
- Create: `smart-image-studio/backend/scripts/export_openapi.py`
- Modify: `smart-image-studio/backend/pyproject.toml`

- [ ] Create `smart-image-studio/backend/scripts/export_openapi.py`:

```python
import json
import sys
from app.main import app

sys.stdout.buffer.write(
    (json.dumps(app.openapi(), ensure_ascii=False, indent=2) + "\n").encode("utf-8")
)
```

- [ ] Add the taskipy task to `backend/pyproject.toml`. The complete `[tool.taskipy.tasks]` block:

```toml
[tool.taskipy.tasks]
dev = "PYTHONPATH=src uvicorn app.main:app --reload --port 8000"
format = "ruff format src/app/"
lint = "ruff check src/app/"
typecheck = "mypy src/app/"
test = "pytest"
export-openapi = "python scripts/export_openapi.py > ../docs/openapi.json"
```

- [ ] Run the export from `smart-image-studio/backend/`:

```bash
cd smart-image-studio/backend && poetry run task export-openapi
```

- [ ] Verify valid JSON and expected components are present:

```bash
python -m json.tool smart-image-studio/docs/openapi.json > /dev/null && echo "valid JSON"
grep '"ImageProcessJob"' smart-image-studio/docs/openapi.json | head -3
grep '"ProcessImageResponse"' smart-image-studio/docs/openapi.json | head -3
grep '"ImageOperationStep"' smart-image-studio/docs/openapi.json | head -3
```

Expected: Each grep returns at least 1 line.

- [ ] Commit:

```bash
git add smart-image-studio/backend/scripts/export_openapi.py \
        smart-image-studio/backend/pyproject.toml \
        smart-image-studio/docs/openapi.json
git commit -m "chore: add openapi export script and static spec"
```

---

## Task 2: CI workflow

**Files:**
- Create: `.github/workflows/check-generated.yml`

Adding CI before codegen so the migration PR itself is protected from stale-generation drift.

- [ ] Create `.github/workflows/check-generated.yml`:

```yaml
name: Check generated files

on:
  push:
    branches: [main]
  pull_request:

jobs:
  check-generated:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: smart-image-studio

    steps:
      - uses: actions/checkout@v4

      - name: Set up Python 3.13
        uses: actions/setup-python@v5
        with:
          python-version: '3.13'

      - name: Install Poetry
        run: pip install poetry

      - name: Install backend dependencies
        run: cd backend && poetry install --no-root

      - name: Set up Node 20
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install frontend dependencies
        run: cd frontend && npm ci

      - name: Regenerate and check for diff
        run: |
          cd backend && poetry run task export-openapi
          cd ../frontend && npm run codegen
          git diff --exit-code
```

- [ ] Commit:

```bash
git add .github/workflows/check-generated.yml
git commit -m "ci: add check for stale generated files"
```

---

## Task 3: Install Orval and create config

**Files:**
- Modify: `smart-image-studio/frontend/package.json`
- Create: `smart-image-studio/frontend/orval.config.ts`

- [ ] Install Orval:

```bash
cd smart-image-studio/frontend && npm install --save-dev orval
```

- [ ] Add `codegen` to the `scripts` section of `frontend/package.json`:

```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "codegen": "orval --config orval.config.ts"
},
```

- [ ] Create `frontend/orval.config.ts`:

```ts
import { defineConfig } from 'orval';

export default defineConfig({
  apiTypes: {
    input: '../docs/openapi.json',
    output: {
      mode: 'single',
      target: './src/shared/api/__generated__/api.types.ts',
      override: {
        useTypeOverInterfaces: true,
      },
    },
  },
  apiSchemas: {
    input: '../docs/openapi.json',
    output: {
      mode: 'single',
      target: './src/shared/api/__generated__/api.schemas.ts',
      client: 'zod',
    },
  },
});
```

- [ ] Commit:

```bash
git add smart-image-studio/frontend/package.json \
        smart-image-studio/frontend/package-lock.json \
        smart-image-studio/frontend/orval.config.ts
git commit -m "chore: install orval and add codegen config"
```

---

## Task 4: Run codegen and inspect output

**Files:**
- Create (generated): `frontend/src/shared/api/__generated__/api.types.ts`
- Create (generated): `frontend/src/shared/api/__generated__/api.schemas.ts`

- [ ] Run codegen:

```bash
cd smart-image-studio/frontend && npm run codegen
```

- [ ] **Inspect `api.types.ts`.** Check:

  1. **Fetch functions mixed in?** Look for `export const get...` or `export const post...` patterns. If present, add a header comment to the file:
     ```ts
     // AUTO-GENERATED — DO NOT EDIT. Run `npm run codegen` to regenerate.
     // Fetch functions below are generated artifacts — use shared/api/jobApi.ts instead.
     ```

  2. **Note the exact exported type names** for these four types (they may differ from frontend names due to Pydantic class naming):

     | Expected frontend name | Likely Orval name | Actual generated name |
     |---|---|---|
     | `OperationType` | `OperationType` | _____________ |
     | `OperationStep` | `ImageOperationStep` | _____________ |
     | `OperationParameters` | `ImageOperationParameters` | _____________ |
     | `ProcessImageResponse` | `ProcessImageResponse` | _____________ |

     Fill in the "Actual generated name" column — you will need these in Task 5.

- [ ] **Inspect `api.schemas.ts`.** Check:

  1. File imports from `zod` (e.g., `import { z } from 'zod'`)
  2. Note the exact exported schema names for:

     | Used in codebase | Likely Orval name | Actual generated name |
     |---|---|---|
     | `imageProcessJobSchema` | `imageProcessJobSchema` | _____________ |
     | `processImageResponseSchema` | `processImageResponseSchema` | _____________ |
     | `operationTypeSchema` | `operationTypeSchema` | _____________ |

  3. Verify number constraints are present (e.g., `.min(1).max(25)`) — these come from `ge`/`le` Pydantic `Field` constraints and should appear in the OpenAPI spec.

- [ ] Commit the generated files:

```bash
git add smart-image-studio/frontend/src/shared/api/__generated__/
git commit -m "chore: initial orval codegen output"
```

---

## Task 5: Rewrite shared/types/api.ts as adapter layer

**Files:**
- Modify: `frontend/src/shared/types/api.ts`

This file stays but is rewritten to:
- Re-export all generated types (with name aliases to preserve frontend type names)
- Override `ImageProcessJob` with the hand-written discriminated union
- Keep `ProcessImageRequest` hand-written (form upload type, not in OpenAPI spec)

**Use the actual generated names you noted in Task 4 in place of `ImageOperationStep` / `ImageOperationParameters` below.**

- [ ] Replace the entire content of `frontend/src/shared/types/api.ts`:

```ts
// Adapter over Orval-generated types.
// - Aliases generated names to the frontend names used throughout the codebase.
// - Overrides ImageProcessJob with a discriminated union (the backend model is flat;
//   Orval cannot derive the discriminated union from OpenAPI alone).
// - Keeps ProcessImageRequest hand-written (form upload — not an OpenAPI schema component).
export type {
  OperationType,
  ProcessImageResponse,
  HealthResponse,
  ApiValidationErrorDetail,
  ApiErrorBody,
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

// Alias backend model names to the shorter names used in this frontend.
// If Orval generated these as 'OperationStep' and 'OperationParameters' (same names),
// remove the `as` aliases and use a plain re-export instead.
export type {
  ImageOperationStep as OperationStep,
  ImageOperationParameters as OperationParameters,
} from '@shared/api/__generated__/api.types';

import type { ProcessImageResponse } from '@shared/api/__generated__/api.types';
import type { ImageOperationStep as OperationStep } from '@shared/api/__generated__/api.types';

interface ImageProcessJobBase {
  job_id: string;
  progress: number;
  message: string;
  filename: string;
  created_at: string;
  applied_operations: OperationStep[];
}

export type ImageProcessJob =
  | (ImageProcessJobBase & {
      status: 'queued';
      queue_position?: number | null;
      started_at?: null;
      completed_at?: null;
      result?: null;
      error_message?: null;
    })
  | (ImageProcessJobBase & {
      status: 'running';
      started_at: string;
      queue_position?: null;
      completed_at?: null;
      result?: null;
      error_message?: null;
    })
  | (ImageProcessJobBase & {
      status: 'completed';
      started_at: string;
      completed_at: string;
      result: ProcessImageResponse;
      queue_position?: null;
      error_message?: null;
    })
  | (ImageProcessJobBase & {
      status: 'failed';
      started_at: string;
      completed_at: string;
      error_message: string;
      queue_position?: null;
      result?: null;
    });

export type JobStatus = ImageProcessJob['status'];

export interface ProcessImageRequest {
  file: File;
  operations: OperationStep[];
}
```

- [ ] Run type check (schema imports still point to the old path — expect errors only from schema imports, not from type re-exports):

```bash
cd smart-image-studio/frontend && npx tsc --noEmit 2>&1 | grep -v "__generated__"
```

- [ ] Commit:

```bash
git add smart-image-studio/frontend/src/shared/types/api.ts
git commit -m "chore: convert types/api.ts to adapter layer over generated types"
```

---

## Task 6: Update schema import paths (3 files)

**Files:**
- Modify: `frontend/src/shared/api/jobApi.ts`
- Modify: `frontend/src/entities/job/lib/processResultStore.ts`
- Modify: `frontend/src/features/pipeline-edit/lib/pipelineStorage.ts`

Use the exact schema export names you noted in Task 4.

- [ ] Update `src/shared/api/jobApi.ts` line 3. Replace:
```ts
import { imageProcessJobSchema } from '@shared/schemas/api.schemas';
```
With (substituting the actual generated name if different):
```ts
import { imageProcessJobSchema } from '@shared/api/__generated__/api.schemas';
```

- [ ] Update `src/entities/job/lib/processResultStore.ts` line 4. Replace:
```ts
import { processImageResponseSchema } from '@shared/schemas/api.schemas';
```
With (substituting the actual generated name if different):
```ts
import { processImageResponseSchema } from '@shared/api/__generated__/api.schemas';
```

- [ ] Update `src/features/pipeline-edit/lib/pipelineStorage.ts` line 4. Replace:
```ts
import { operationTypeSchema } from '@shared/schemas/api.schemas';
```
With (substituting the actual generated name if different):
```ts
import { operationTypeSchema } from '@shared/api/__generated__/api.schemas';
```

- [ ] Run type check:

```bash
cd smart-image-studio/frontend && npx tsc --noEmit
```

Expected: No errors. If there are errors about missing exports, open `__generated__/api.schemas.ts` and search for the correct exported names.

- [ ] Commit:

```bash
git add smart-image-studio/frontend/src/shared/api/jobApi.ts \
        smart-image-studio/frontend/src/entities/job/lib/processResultStore.ts \
        smart-image-studio/frontend/src/features/pipeline-edit/lib/pipelineStorage.ts
git commit -m "chore: update schema imports to orval-generated file"
```

---

## Task 7: Delete old hand-written schemas file

**Files:**
- Delete: `frontend/src/shared/schemas/api.schemas.ts`

`shared/types/api.ts` is **NOT** deleted.

- [ ] Delete:

```bash
rm smart-image-studio/frontend/src/shared/schemas/api.schemas.ts
```

- [ ] Run type check:

```bash
cd smart-image-studio/frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] Commit:

```bash
git add -u smart-image-studio/frontend/src/shared/schemas/api.schemas.ts
git commit -m "chore: remove hand-written zod schemas replaced by orval"
```

---

## Task 8: Final verification

- [ ] Full type check:

```bash
cd smart-image-studio/frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] Simulate CI check locally:

```bash
cd smart-image-studio/backend && poetry run task export-openapi
cd smart-image-studio/frontend && npm run codegen
git diff --exit-code
```

Expected: No diff. If there is a diff, the orval config or export script produced non-deterministic output — investigate and fix before proceeding.

- [ ] Start the dev server and verify the app loads:

```bash
cd smart-image-studio/frontend && npm run dev
```

Open `http://localhost:5173`. Verify:
- Studio page loads with no console errors
- Pipeline editor renders correctly
- No TypeScript errors in browser console

---

## Known degradations (accepted per design)

| Item | Before | After | Impact |
|---|---|---|---|
| `extra="forbid"` on `ImageOperationParameters` | Zod `.strict()` | Orval may reproduce via `additionalProperties: false` in spec — check generated output | Extra fields pass silently if Orval omits it |
| Number constraints on `ImageOperationParameters` | `.min()/.max()/.int()` via hand-written Zod | Reproduced by Orval from `ge`/`le` Pydantic Field constraints (these appear in OpenAPI spec) | No regression expected |
| `blur_strength_must_be_odd` | Not checked in frontend Zod (only backend validates) | Unchanged | No regression |
