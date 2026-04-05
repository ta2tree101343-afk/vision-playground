# Smart Image Studio

画像をアップロードし、各種画像処理を適用し、元画像と加工後画像を比較できる Web アプリです。MVP としてローカル環境で動かすことを優先しつつ、今後の AI 機能追加を見据えて frontend / backend を責務分離したモノレポ構成にしています。

## ディレクトリ構成

```text
smart-image-studio/
├── .gitignore
├── README.md
├── docs/
│   └── architecture.md
├── frontend/
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   ├── postcss.config.cjs
│   ├── tailwind.config.ts
│   ├── tsconfig.app.json
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   ├── vite.config.ts
│   └── src/
│       ├── App.tsx
│       ├── api/
│       │   ├── apiClient.ts
│       │   ├── imageApi.ts
│       │   └── pipelineApi.ts
│       ├── components/
│       │   ├── ActionPanel.tsx
│       │   ├── AnalysisPanel.tsx
│       │   ├── ComparisonPanel.tsx
│       │   ├── ErrorBanner.tsx
│       │   ├── Header.tsx
│       │   ├── JobHistoryPanel.tsx
│       │   ├── JobStatusPanel.tsx
│       │   ├── NaturalLanguagePlanner.tsx
│       │   ├── OperationSelector.tsx
│       │   ├── ParameterControls.tsx
│       │   ├── PipelineEditor.tsx
│       │   ├── StatusBanner.tsx
│       │   └── UploadPanel.tsx
│       ├── config/
│       │   ├── env.ts
│       │   ├── imageOperations.ts
│       │   └── pipelinePresets.ts
│       ├── hooks/
│       │   └── useImageStudio.ts
│       ├── pages/
│       │   ├── ResultPage.tsx
│       │   └── StudioPage.tsx
│       ├── styles/
│       │   └── index.css
│       ├── types/
│       │   ├── api.ts
│       │   └── image.ts
│       ├── utils/
│       │   ├── file.ts
│       │   ├── navigation.ts
│       │   ├── pipeline.ts
│       │   ├── pipelineStorage.ts
│       │   └── processResultStore.ts
│       ├── main.tsx
│       └── vite-env.d.ts
└── backend/
    ├── .env.example
    ├── requirements.txt
    ├── uploads/
    │   └── .gitkeep
    └── app/
        ├── api/
        │   ├── router.py
        │   └── routes/
        │       ├── health.py
        │       ├── images.py
        │       └── pipeline.py
        ├── core/
        │   └── config.py
        ├── models/
        │   ├── MobileNetSSD_deploy.prototxt
        │   └── mobilenet_iter_73000.caffemodel
        ├── schemas/
        │   ├── image.py
        │   └── pipeline.py
        ├── services/
        │   ├── image_processor.py
        │   ├── job_service.py
        │   ├── llm_interpreter.py
        │   ├── object_detection_service.py
        │   ├── ocr_service.py
        │   ├── pipeline_interpreter.py
        │   ├── pipeline_interpreter_factory.py
        │   ├── rule_based_interpreter.py
        │   └── storage_service.py
        ├── utils/
        │   └── image_validation.py
        └── main.py
```

## 主な機能

- 画像アップロード
- アップロード画像のプレビュー
- 画像処理
  - grayscale
  - blur
  - sharpen
  - denoise
  - edge detection
  - brightness adjustment
  - background removal
  - OCR
  - object detection
  - caption generation
- パラメータ調整
  - blur strength
  - brightness
  - sharpen strength
  - detection threshold
- 複数処理パイプライン
  - ステップ追加
  - ステップ並び替え
  - ステップ削除
  - ステップごとのパラメータ設定
  - 作業中パイプライン保存
  - 名前付きプリセット保存
  - 標準プリセット読み込み
- 自然言語からパイプライン提案
  - backend の interpreter が日本語指示を処理フローに変換
  - 提案内容を確認してからパイプラインへ反映
  - `rule_based / llm` を settings で切り替え可能
  - LLM 出力は schema validate 後にのみ実行
- 非同期ジョブ処理
  - job id 発行
  - 実行中ステータス
  - 進捗表示
  - 完了通知
  - 処理履歴
- Before / After 比較表示
  - ズーム同期
  - パン同期
  - 差分表示
  - 処理前後ヒストグラム
- OCR / object detection の解析結果表示
- AI 結果の可視化
  - 物体検出の bounding box
  - 信頼度スコア表示
  - OCR の認識位置表示
  - 背景除去マスク表示
  - caption 候補の複数表示
- 加工後画像のダウンロード
- エラーハンドリング
  - 非画像ファイル
  - 処理失敗
  - 通信失敗

## 技術スタック

### frontend

- React
- TypeScript
- Vite
- Tailwind CSS

### backend

- Python
- FastAPI
- Pillow
- OpenCV
- RapidOCR
- MobileNet SSD

## 初期セットアップ

### 1. frontend

```bash
cd frontend
cp .env.example .env
npm install
```

`.env`:

```env
VITE_API_BASE_URL=http://localhost:8000
```

### 2. backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

`.env`:

```env
SMART_IMAGE_STUDIO_APP_NAME=Smart Image Studio API
SMART_IMAGE_STUDIO_DEBUG=false
SMART_IMAGE_STUDIO_CORS_ORIGINS=http://localhost:5173
SMART_IMAGE_STUDIO_UPLOAD_DIR=uploads
SMART_IMAGE_STUDIO_PIPELINE_INTERPRETER_MODE=rule_based
SMART_IMAGE_STUDIO_LLM_API_BASE_URL=https://api.openai.com/v1
SMART_IMAGE_STUDIO_LLM_API_KEY=
SMART_IMAGE_STUDIO_LLM_MODEL=
SMART_IMAGE_STUDIO_LLM_TIMEOUT_SECONDS=30
```

## ローカル起動手順

### backend を起動

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

### frontend を起動

```bash
cd frontend
npm run dev
```

起動後:

- frontend: `http://localhost:5173`
- backend: `http://localhost:8000`
- health check: `http://localhost:8000/health`
- OpenAPI: `http://localhost:8000/docs`

## API 設計

### GET `/health`

疎通確認用です。

レスポンス例:

```json
{
  "status": "ok"
}
```

### POST `/api/images/process`

`multipart/form-data` で画像と処理内容を受け取ります。

必須:

- `file`

初期実装での基本入力:

- `operations`: JSON 文字列

複数処理パイプライン例:

例:

```json
[
  {
    "operation": "brightness",
    "parameters": {
      "brightness": 20
    }
  },
  {
    "operation": "blur",
    "parameters": {
      "blur_strength": 5
    }
  },
  {
    "operation": "sharpen",
    "parameters": {
      "sharpen_strength": 2
    }
  }
]
```

後方互換用に、以下の単一処理フォーム項目も受け付けます。

- `operation`
- `blur_strength`
- `brightness`
- `sharpen_strength`
- `detection_threshold`

レスポンス例:

```json
{
  "message": "画像処理が完了しました。",
  "original_image_url": "http://localhost:8000/uploads/originals/...",
  "processed_image_url": "http://localhost:8000/uploads/processed/...",
  "processed_filename": "....png",
  "applied_operations": [
    {
      "operation": "object_detection",
      "parameters": {
        "detection_threshold": 0.45
      }
    }
  ],
  "analysis": {
    "background_removal": null,
    "ocr": null,
    "object_detection": {
      "model": "MobileNet SSD (VOC)",
      "threshold": 0.45,
      "detections": [
        {
          "label": "dog",
          "confidence": 0.82,
          "bounding_box": {
            "x": 120,
            "y": 80,
            "width": 210,
            "height": 180
          }
        }
      ]
    }
  }
}
```

### POST `/api/images/jobs`

非同期ジョブを作成します。レスポンスは `202 Accepted` で、`job_id` と進捗追跡用の状態を返します。

### GET `/api/images/jobs`

ジョブキューと履歴を新しい順で返します。

### GET `/api/images/jobs/{job_id}`

個別ジョブの状態を返します。`completed` になると `result` に before / after 用の結果が入ります。

### POST `/api/pipeline/interpret`

自然文を `PipelinePlan` に変換します。backend は settings に応じて `rule_based` または `llm` interpreter を使います。

### POST `/api/images/process-pipeline`

`multipart/form-data` で `file` と `plan` を受け取り、schema validate 済みの `PipelinePlan` を画像処理 executor に渡します。

## frontend API クライアント設計

### `src/api/apiClient.ts`

共通責務を持ちます。

- `baseURL` を `VITE_API_BASE_URL` から解決
- JSON / FormData のリクエスト組み立て
- JSON / text レスポンスの共通パース
- HTTP エラーを `ApiError` に正規化
- ダウンロード用の blob 取得

### パイプライン保存

- 作業中パイプラインは localStorage に保存可能
- 名前付きプリセットも localStorage に保存
- 標準プリセットとして以下を同梱
  - SNS向け補正
  - OCR前処理
  - 人物写真補正
  - 商品画像整形

### 非同期ジョブ追跡

- frontend は polling で `/api/images/jobs/{job_id}` を監視
- 完了後は結果を sessionStorage に保存して `/result` へ遷移
- ジョブ履歴は `/api/images/jobs` から取得

### `src/api/imageApi.ts`

画像処理 API のユースケース関数を持ちます。

- `fetchHealth()`
- `processImage()`
- `createProcessJob()`
- `fetchProcessJob()`
- `fetchProcessJobs()`
- `downloadProcessedImage()`

### `src/api/pipelineApi.ts`

- `interpretPipeline()`
- `processPipelineImage()`

画面側は `useImageStudio` からこれらを呼び出すだけにして、`fetch` を直接書かない構成にしています。

## 実装上のポイント

- frontend は `components` / `api` / `hooks` / `types` / `pages` / `styles` に責務分離
- backend は `routes` / `schemas` / `services` / `utils` に責務分離
- `operations` を配列で受ける設計にして、将来的な複数処理チェーンに対応しやすくしている
- 自然文解釈は `PipelineInterpreter` interface を切り、`RuleBasedInterpreter` と `LLMInterpreter` を差し替え可能にしている
- 画像検証を frontend / backend の両方で実施
- 加工結果は `backend/uploads/processed` にローカル保存
- OCR は `rapidocr-onnxruntime` を使い、抽出文字列をレスポンスにも返す
- object detection は repo 同梱の MobileNet SSD モデルでローカル推論する
- background removal は GrabCut ベースで透過 PNG を生成する

## 今後の拡張案

- 背景除去
- 物体検出
- OCR
- 自動キャプション生成
- 処理履歴保存
- ユーザーごとの作業セッション管理
- 複数処理を UI 上で並べて順番に適用するワークフロー

## 開発メモ

- 詳細な構成意図は [docs/architecture.md](./docs/architecture.md) に記載しています。
- 本 MVP はスマホ完全最適化までは行っていませんが、極端に崩れないレイアウトにしています。
