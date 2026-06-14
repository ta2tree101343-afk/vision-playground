# Smart Image Studio

画像をアップロードし、各種画像処理を適用し、元画像と加工後画像を比較できる Web アプリです。MVP としてローカル環境で動かすことを優先しつつ、今後の AI 機能追加を見据えて frontend / backend を責務分離したモノレポ構成にしています。

## ディレクトリ構成

```text
smart-image-studio/
├── .gitignore
├── README.md
├── docker-compose.yml
├── docs/
│   └── openapi.json                  # Orval 型生成用 OpenAPI スナップショット
├── frontend/
│   ├── Dockerfile
│   ├── .env.example
│   ├── vite.config.ts
│   └── src/                          # Feature-Sliced Design (FSD)
│       ├── app/                      # エントリポイント・ルーティング・プロバイダ
│       ├── pages/                    # StudioPage, ResultPage
│       ├── widgets/                  # analysis-panel, comparison-panel など
│       ├── features/                 # image-upload, job-tracking, pipeline-edit, operation-select
│       ├── entities/                 # image, job, pipeline ドメインオブジェクト
│       └── shared/                   # api, config, lib, types, ui
└── backend/
    ├── .env.example
    ├── Dockerfile
    ├── pyproject.toml
    ├── alembic/                      # DBマイグレーション
    └── src/app/
        ├── assets/ml_models/         # MobileNetSSD_deploy.prototxt (caffemodel は要別途DL)
        ├── controllers/              # リクエスト解析・レスポンス整形
        ├── core/                     # config, constants, exceptions, logging
        ├── db/                       # SQLAlchemy engine, models
        ├── dependencies/             # @lru_cache シングルトンファクトリ
        ├── handlers/                 # 例外ハンドラ
        ├── infrastructure/           # image_processing, object_detection, ocr, llm, storage, queue
        ├── middlewares/              # CORS, ロギング
        ├── repositories/             # job_repository (SQLAlchemy)
        ├── routes/                   # HTTPバインディング
        ├── schemas/                  # Pydantic スキーマ
        ├── services/                 # ビジネスロジック
        ├── utils/                    # annotation_util, image_util, datetime_util など
        ├── validators/               # リクエストバリデーション
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
- Poetry
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
poetry install
cp .env.example .env
```

`.env`:

```env
SMART_IMAGE_STUDIO_APP_NAME=Smart Image Studio API
SMART_IMAGE_STUDIO_DEBUG=false
SMART_IMAGE_STUDIO_CORS_ORIGINS=http://localhost:5173
SMART_IMAGE_STUDIO_UPLOAD_DIR=uploads
SMART_IMAGE_STUDIO_DATABASE_URL=postgresql+psycopg://smart_image_studio:smart_image_studio@localhost:5432/smart_image_studio
SMART_IMAGE_STUDIO_LLM_API_BASE_URL=http://localhost:1234/v1
SMART_IMAGE_STUDIO_LLM_MODEL=qwen/qwen3-vl-8b
SMART_IMAGE_STUDIO_LLM_API_KEY=lm-studio
```

## Docker での起動（推奨）

### 前準備（初回のみ）

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### 起動

```bash
cd smart-image-studio
docker compose up --build  # 初回 or Dockerfile 変更時
docker compose up          # 通常
```

### 停止

```bash
docker compose down          # 停止（named volume は保持）
docker compose down -v       # named volume も含めて完全削除
```

起動後:

- frontend: `http://localhost:5173`
- backend: `http://localhost:8000`
- health check: `http://localhost:8000/health`

## ローカル起動手順

### backend を起動

```bash
cd backend
poetry run task dev
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

## 開発ツール（backend）

```bash
cd backend
poetry run task format    # ruff format（コードフォーマット）
poetry run task lint      # ruff check（lint）
poetry run task typecheck # mypy（型チェック）
poetry run task test      # pytest（テスト）
```

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

## frontend API クライアント設計

### `src/shared/api/apiClient.ts`

共通責務を持ちます。

- `baseURL` を `VITE_API_BASE_URL` から解決
- JSON / FormData のリクエスト組み立て
- JSON / text レスポンスの共通パース
- HTTP エラーを `ApiError` に正規化
- ダウンロード用の blob 取得

### `src/shared/api/jobApi.ts`

ジョブ API のユースケース関数を持ちます。

- `createProcessJob()`
- `fetchProcessJob()`
- `fetchProcessJobs()`

### パイプライン保存

- 作業中パイプラインは localStorage に保存可能
- 名前付きプリセットも localStorage に保存
- 標準プリセットとして以下を同梱
  - SNS向け補正
  - OCR前処理
  - 人物写真補正
  - 商品画像整形

### 非同期ジョブ追跡

- `useJobTracking` が polling で `/api/images/jobs/{job_id}` を 1500 ms 間隔で監視
- ジョブ完了/失敗後にジョブ一覧を再取得し、次のアクティブジョブを再選択
- 完了後は結果を sessionStorage に保存して `/result` へ遷移
- ジョブ履歴は `/api/images/jobs` から取得

## 実装上のポイント

- frontend は **Feature-Sliced Design (FSD)** で `app` / `pages` / `widgets` / `features` / `entities` / `shared` の 6 層に責務分離
- backend は `route → controller → service → repository` の層構造。`infrastructure/` が外部ライブラリをラップする
- ジョブは **PostgreSQL** (SQLAlchemy + Alembic) で永続化。`JSONB` 型を使うため SQLite は非対応。インプロセスキューはメモリのみで、再起動時は `mark_interrupted_jobs()` でリカバリ
- キュー満杯でジョブがキャンセルされた場合、保存済みの元画像ファイルも削除して孤児ファイルを防ぐ
- `JobRepository.update()` はステータス遷移時に必須タイムスタンプ (`started_at`, `completed_at`) を自動補完する
- `operations` を配列で受ける設計にして、複数処理チェーンに対応
- 画像検証を frontend / backend の両方で実施
- 加工結果は `backend/uploads/processed` にローカル保存
- OCR は `rapidocr-onnxruntime` を使い、抽出文字列をレスポンスにも返す
- object detection は MobileNet SSD モデルでローカル推論する (`mobilenet_iter_73000.caffemodel` は `.gitignore` で除外されているため、初回は https://github.com/chuanqi305/MobileNet-SSD から手動でダウンロードして `backend/src/app/assets/ml_models/` に配置する必要があります)
- background removal は GrabCut ベースで透過 PNG を生成する

## 今後の拡張案

- ユーザーごとの作業セッション管理
- クラウドストレージへの保存対応
- 処理プリセットのサーバーサイド管理・共有

## 開発メモ

- `docs/openapi.json` は Orval の入力として使うため、削除しないでください。
- 本 MVP はスマホ完全最適化までは行っていませんが、極端に崩れないレイアウトにしています。
