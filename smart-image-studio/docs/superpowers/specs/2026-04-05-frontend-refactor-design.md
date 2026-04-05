# フロントエンドリファクタリング設計

## 目標

- ボイラープレートの排除（型の重複・同一ID生成関数・switch文）
- hookの単一責務化による将来の機能追加のしやすさ

## 1. 型の統合

### 変更ファイル: `src/types/api.ts`

`ImageOperationType` と `PipelineOperationType` を廃止し、`OperationType` に統合する。
両者の差異はなく（和集合が同一）、2つを維持する理由がない。

```ts
// 削除
type ImageOperationType = ...
type PipelineOperationType = ...

// 追加
type OperationType =
  | 'grayscale' | 'blur' | 'sharpen' | 'denoise'
  | 'edge_detection' | 'brightness' | 'contrast'
  | 'background_removal' | 'ocr' | 'object_detection' | 'caption_generation'
```

`ImageOperationStep` と `PipelineStep` も統合する。

```ts
// 削除
interface ImageOperationStep { operation: ImageOperationType; parameters?: ImageOperationParameters }
interface PipelineStep { operation: PipelineOperationType; parameters?: ImageOperationParameters }

// 追加
interface OperationStep { operation: OperationType; parameters?: OperationParameters }
```

`ImageOperationParameters` は `OperationParameters` にリネーム。

`ProcessImageRequest.operations` の型を `OperationStep[]` に更新。

### 変更ファイル: `src/types/image.ts`

- `ParameterKey` の型参照を `OperationType` ベースに更新
- `StudioPlannerState`（未使用）を削除

### 変更ファイル: `src/config/imageOperations.ts`

- `ImageOperationType` の参照を `OperationType` に更新

## 2. ユーティリティの整理

### 変更ファイル: `src/utils/pipeline.ts`

#### ID生成の統一

`createStepId`・`createPresetId`・`createPlannerHistoryId` の3関数は同一実装。
`createId(prefix: string)` に統一し、呼び出し元でprefixを渡す。

**`clonePipelineTemplate`（singular）の削除**

`clonePipelineTemplates` 内でインライン化する。外部から直接呼び出されていないため。

**`buildOperationStep` の switch → マップ**

switch文は操作追加のたびに伸びる。マップ方式にすることで、新規操作の追加は1行で済む。

```ts
const parameterMap: Record<OperationType, (p: ParameterState) => OperationParameters> = {
  blur:             (p) => ({ blur_strength: p.blurStrength }),
  brightness:       (p) => ({ brightness: p.brightness }),
  contrast:         (p) => ({ contrast: p.contrast }),
  sharpen:          (p) => ({ sharpen_strength: p.sharpenStrength }),
  denoise:          (p) => ({ denoise_strength: p.denoiseStrength }),
  object_detection: (p) => ({ detection_threshold: p.detectionThreshold / 100 }),
  grayscale:        () => ({}),
  edge_detection:   () => ({}),
  background_removal: () => ({}),
  ocr:              () => ({}),
  caption_generation: () => ({}),
}
```

## 3. Hookの分割

### 削除: `src/hooks/useImageStudio.ts`

737行・30以上の戻り値を持つgod hook。4つのhookに分割する。

### 追加: `src/hooks/useFile.ts`

ファイル選択・プレビューURL生成・デモ画像生成を担当。

```ts
return {
  selectedFile,
  previewUrl,
  selectFile,      // バリデーションを内包
  loadDemoImage,
}
```

### 追加: `src/hooks/usePipeline.ts`

パイプラインのステップ編集・プリセット管理・下書き保存を担当。

```ts
return {
  steps,
  addStep,
  removeStep,
  moveStep,
  updateStepParameter,
  savedPresets,
  presetName,
  setPresetName,
  savePreset,
  deletePreset,
  applyPreset,
  savedDraftAt,
  saveDraft,
  loadDraft,
}
```

### 追加: `src/hooks/usePlanner.ts`

自然言語プランナー・プラン生成・履歴を担当。

```ts
return {
  instruction,
  setInstruction,
  mode,
  setMode,
  plan,
  isInterpreting,
  generatePlan,
  applyPlan,       // planのstepsをpipelineに反映する callback を受け取る
  history,
  selectHistory,
}
```

### 追加: `src/hooks/useJobTracking.ts`

ジョブ作成・ポーリング・履歴管理を担当。

```ts
// オプション
interface UseJobTrackingOptions {
  onCompleted?: (result: ProcessImageResponse) => void
}

return {
  activeJob,
  jobHistory,
  isProcessing,
  errorMessage,
  submitJob,       // file と operations を受け取りジョブを作成
  openJobResult,
}
```

### 変更: `src/pages/StudioPage.tsx`

`useImageStudio` の import を削除し、4つのhookを直接使う。

```tsx
const file = useFile()
const pipeline = usePipeline()
const planner = usePlanner()
const jobs = useJobTracking({ onCompleted: navigateToResult })
```

各hookは `errorMessage: string | null` を返す。`StudioPage` では `file.errorMessage ?? pipeline.errorMessage ?? planner.errorMessage ?? jobs.errorMessage` でまとめて表示する。

`canProcess`（ファイルとステップの両方が揃っているか）は `useFile` と `usePipeline` をまたぐため、`StudioPage` 側で `!!file.selectedFile && pipeline.steps.length > 0` として計算する。

`usePlanner` は生成したプランを返すだけ。`StudioPage` が `pipeline.setSteps(planner.plan.steps)` を呼ぶことでパイプラインに反映する。

## ファイル変更一覧

| ファイル | 変更種別 |
| --- | --- |
| `src/types/api.ts` | 変更（型統合） |
| `src/types/image.ts` | 変更（不使用削除・参照更新） |
| `src/config/imageOperations.ts` | 変更（参照更新） |
| `src/utils/pipeline.ts` | 変更（switch→マップ・ID統一・singular削除） |
| `src/hooks/useImageStudio.ts` | **削除** |
| `src/hooks/useFile.ts` | **新規** |
| `src/hooks/usePipeline.ts` | **新規** |
| `src/hooks/usePlanner.ts` | **新規** |
| `src/hooks/useJobTracking.ts` | **新規** |
| `src/pages/StudioPage.tsx` | 変更（hook import差し替え） |
| `src/api/imageApi.ts` | 変更（型参照更新） |
| `src/api/pipelineApi.ts` | 変更（型参照更新） |

## スコープ外

- コンポーネント（`components/`）の変更
- スタイルの変更

---

## バックエンドリファクタリング設計

### バックエンドの目標

フロントエンドと同じ方針でバックエンドの重複を排除し、操作追加時の変更箇所を最小化する。

### 1. Schema の統合

#### 現状の重複

| `schemas/image.py` | `schemas/pipeline.py` | 差異 |
| --- | --- | --- |
| `OperationType` | `PipelineOperationType` | 値が同一 |
| `ImageOperationParameters` | `PipelineStepParameters` | フィールドが同一 |
| `ImageOperationStep` | `PipelineStep` | 構造が同一（`PipelineStep` のみ model_validator あり） |

#### 変更内容

`schemas/pipeline.py` から `PipelineOperationType`・`PipelineStepParameters`・`PipelineStep` を削除する。
`PipelinePlan.steps` の型を `list[ImageOperationStep]` に変更する。

`PipelineStep` が持っていた model_validator（パラメータ整合チェック）を `ImageOperationStep` に移植する。

```python
# schemas/image.py に追加
@model_validator(mode="after")
def validate_supported_parameters(self) -> "ImageOperationStep":
    parameter_map = {
        OperationType.BLUR: ["blur_strength"],
        OperationType.SHARPEN: ["sharpen_strength"],
        OperationType.DENOISE: ["denoise_strength"],
        OperationType.BRIGHTNESS: ["brightness"],
        OperationType.CONTRAST: ["contrast"],
        OperationType.OBJECT_DETECTION: ["detection_threshold"],
    }
    allowed_keys = set(parameter_map.get(self.operation, []))
    for field_name in self.parameters.model_dump(exclude_none=True):
        if field_name not in allowed_keys:
            raise ValueError(
                f"{self.operation.value} では {field_name} パラメータは使用できません。"
            )
    return self
```

#### bridge 関数の削除

`api/routes/images.py` の `build_operation_steps_from_plan` は `PipelineStep` → `ImageOperationStep` の変換のためだけに存在する。
Schema 統合後は `PipelinePlan.steps` が直接 `list[ImageOperationStep]` になるため削除できる。

```python
# Before
steps = build_operation_steps_from_plan(pipeline_plan)

# After
steps = pipeline_plan.steps
```

### 2. ImageProcessor の内部整理

#### 重複 dataclass の統合

`OperationApplicationResult` と `ImageProcessingResult` は同一フィールドを持つ。
`OperationApplicationResult` を削除し、内部ハンドラも `ImageProcessingResult` を返すよう統一する。

```python
# Before: 2種類の dataclass
def _apply_blur(...) -> OperationApplicationResult:
    return OperationApplicationResult(image=...)

# After: 1種類に統一
def _apply_blur(...) -> ImageProcessingResult:
    return ImageProcessingResult(image=...)
```

#### マスクURL生成ロジックの重複解消

`api/routes/images.py` の `attach_analysis_assets` と `services/job_service.py` の `_process_job` に
同じマスクURL付与ロジックが存在する。

`attach_analysis_assets` を `services/storage_service.py` に移動し、
`images.py` と `job_service.py` の両方から import する。

### バックエンドのファイル変更一覧

| ファイル | 変更内容 |
| --- | --- |
| `app/schemas/image.py` | `ImageOperationStep` に model_validator を追加 |
| `app/schemas/pipeline.py` | `PipelineOperationType`・`PipelineStepParameters`・`PipelineStep` を削除。`PipelinePlan.steps` の型を `list[ImageOperationStep]` に変更 |
| `app/services/image_processor.py` | `OperationApplicationResult` を削除。全ハンドラが `ImageProcessingResult` を返す |
| `app/api/routes/images.py` | `build_operation_steps_from_plan` を削除 |
| `app/services/storage_service.py` | `attach_analysis_assets` を追加（`images.py` から移動） |
| `app/services/job_service.py` | `attach_analysis_assets` の import 先を `storage_service` に変更 |

#### 既存のままのファイル

`rule_based_interpreter.py`・`llm_interpreter.py`・`pipeline_interpreter_factory.py`・
`pipeline_interpreter.py`・`main.py`・`core/config.py`・`utils/image_validation.py`・
`api/routes/pipeline.py`・`api/routes/health.py`
