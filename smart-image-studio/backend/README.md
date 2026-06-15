# Smart Image Studio — Backend

FastAPI + PostgreSQL で構築した画像処理 API サーバーです。
同期処理（即時レスポンス）と非同期ジョブキュー処理の両方のエンドポイントを提供し、OpenCV による画像変換・OCR・物体検出・背景除去・AI キャプション生成をサポートします。

---

## 1. プロジェクト概要

| 項目 | 内容 |
| --- | --- |
| 言語 | Python 3.13 |
| フレームワーク | FastAPI 0.115 |
| DB | PostgreSQL 16（SQLAlchemy + Alembic） |
| 処理モデル | 同期処理（`POST /api/images/process`）/ 非同期ジョブ（`POST /api/images/jobs`） |
| パッケージ管理 | Poetry |

---

## 2. 使用技術

| カテゴリ | ライブラリ | バージョン |
| --- | --- | --- |
| Web フレームワーク | FastAPI + Uvicorn | ≥0.115 / ≥0.30 |
| 画像処理 | OpenCV + Pillow | ≥4.10 / ≥10.4 |
| OCR | RapidOCR + ONNX Runtime | ≥3.0 / ≥1.18 |
| 物体検出 | MobileNet-SSD（ONNX） | — |
| LLM | OpenAI SDK（LM Studio 互換） | ≥1.66 |
| DB ORM | SQLAlchemy + psycopg | ≥2.0 / ≥3.2 |
| マイグレーション | Alembic | ≥1.13 |
| 設定管理 | pydantic-settings | ≥2.4 |

---

## 3. 主な機能

- **画像変換**: グレースケール・ブラー・シャープン・ノイズ除去・エッジ検出・明度/コントラスト調整
- **AI 解析**: OCR（日本語対応）・物体検出（MobileNet-SSD）・背景除去・AI キャプション生成
- **パイプライン実行**: 複数の操作を JSON 配列で指定し順次適用
- **非同期ジョブ**: キューに登録しポーリングで結果を取得（最大 100 件のキュー）
- **入力バリデーション**: ファイルサイズ上限 20 MB、画像形式チェック、Pydantic スキーマバリデーション

---

## 4. セットアップ手順（クイックスタート）

### Docker を使う場合（推奨）

```bash
# リポジトリルートで実行
cp backend/.env.example backend/.env

docker compose up --build
```

API: `http://localhost:8000` / OpenAPI Docs: `http://localhost:8000/docs`

### ローカルで直接起動する場合

```bash
cd backend

# 依存関係インストール
poetry install

# 環境変数設定
cp .env.example .env
# .env の DATABASE_URL を編集して PostgreSQL に接続

# DB マイグレーション
PYTHONPATH=src poetry run alembic upgrade head

# 開発サーバー起動（ホットリロード）
poetry run task dev
```

---

## 5. 環境変数

`.env` ファイル（プレフィックス `SMART_IMAGE_STUDIO_`）で設定します。

| 変数名 | デフォルト値 | 必須 | 説明 |
| --- | --- | --- | --- |
| `DATABASE_URL` | — | ✅ | PostgreSQL 接続 URL（例: `postgresql+psycopg://user:pass@localhost:5432/db`） |
| `PUBLIC_BASE_URL` | `http://localhost:8000` | | フロントエンドからアクセスできるバックエンドの公開 URL。画像 URL の生成に使用 |
| `CORS_ORIGINS` | `http://localhost:5173` | | 許可する CORS オリジン（カンマ区切りで複数指定可） |
| `UPLOAD_DIR` | `uploads` | | アップロードファイルの保存ディレクトリ（プロジェクトルート相対） |
| `LLM_API_BASE_URL` | `http://localhost:1234/v1` | | LLM API のベース URL（LM Studio・OpenAI 互換） |
| `LLM_MODEL` | `qwen/qwen3-vl-8b` | | 使用するモデル名 |
| `LLM_API_KEY` | `lm-studio` | | LLM API キー |
| `DEBUG` | `false` | | デバッグモードの有効化 |

> **Docker Compose の場合**: `DATABASE_URL` と `PUBLIC_BASE_URL` は `docker-compose.yml` の `environment` セクションで上書きされます。`.env` の値は LLM 設定など残りの項目に使用されます。

---

## 6. API 仕様 / エンドポイント

ベースパス: `/api/images`

起動後は `http://localhost:8000/docs`（Swagger UI）で対話的に確認できます。

### ヘルスチェック

| メソッド | パス | 説明 |
| --- | --- | --- |
| `GET` | `/health` | サービスの稼働確認 |

### 同期処理

| メソッド | パス | 説明 |
| --- | --- | --- |
| `POST` | `/api/images/process` | 画像を即時処理して結果を返す |

**リクエスト** (`multipart/form-data`)

| フィールド | 型 | 説明 |
| --- | --- | --- |
| `file` | `File` | 処理対象の画像（最大 20 MB） |
| `operations` | `string` | `ImageOperationStep[]` の JSON 文字列 |

**レスポンス** (`ProcessImageResponse`)

```json
{
  "message": "画像処理が完了しました。",
  "original_image_url": "http://localhost:8000/uploads/originals/...",
  "processed_image_url": "http://localhost:8000/uploads/processed/...",
  "processed_filename": "...",
  "applied_operations": [...],
  "analysis": { "ocr": {...}, "object_detection": {...}, ... }
}
```

### 非同期ジョブ

| メソッド | パス | 説明 |
| --- | --- | --- |
| `POST` | `/api/images/jobs` | ジョブをキューに登録（202 Accepted） |
| `GET` | `/api/images/jobs` | ジョブ一覧を取得（新しい順、最大 100 件） |
| `GET` | `/api/images/jobs/{job_id}` | 特定ジョブのステータスを取得 |

**ジョブのステータス遷移**: `queued` → `running` → `completed` / `failed`

**`ImageOperationStep` の形式**

```json
{ "operation": "blur", "parameters": { "blur_strength": 5 } }
```

**サポートする操作一覧

| operation | 説明 | パラメータ |
| --- | --- | --- |
| `grayscale` | グレースケール変換 | — |
| `blur` | ガウシアンブラー | `blur_strength` (奇数 1–25), `blur_sigma` (0–10) |
| `sharpen` | シャープン | `sharpen_strength` (1–5) |
| `denoise` | ノイズ除去 | `denoise_strength` (1–30) |
| `edge_detection` | エッジ検出 | — |
| `brightness` | 明度調整 | `brightness` (-100–100) |
| `contrast` | コントラスト調整 | `contrast` (-100–100) |
| `background_removal` | 背景除去 | — |
| `ocr` | 文字認識 | — |
| `object_detection` | 物体検出 | `detection_threshold` (0.1–0.95) |
| `caption_generation` | AI キャプション生成 | — |

---

## 7. ディレクトリ構成

```text
backend/
├── src/app/
│   ├── main.py                  # アプリケーションエントリポイント・lifespan
│   ├── core/
│   │   ├── config.py            # 設定（pydantic-settings）
│   │   ├── constants.py         # 定数（ファイルサイズ上限・キューサイズ等）
│   │   └── exceptions.py        # ドメイン例外クラス
│   ├── routes/                  # HTTP メソッド・パスのバインディング
│   ├── controllers/             # リクエスト解析・レスポンス整形
│   ├── services/                # ビジネスロジック
│   │   ├── image_processor.py   # 処理ディスパッチャ
│   │   ├── job_service.py       # ジョブキュー管理
│   │   └── storage_service.py   # ファイル保存・URL 構築
│   ├── repositories/
│   │   └── job_repository.py    # ジョブの DB 永続化
│   ├── infrastructure/
│   │   ├── image_processing/    # OpenCV ラッパー
│   │   ├── ocr/                 # RapidOCR ラッパー
│   │   ├── object_detection/    # MobileNet-SSD ラッパー
│   │   ├── llm/                 # LM Studio クライアント
│   │   ├── storage/             # ローカルファイルストレージ
│   │   └── queue/               # バックグラウンドタスクキュー
│   ├── schemas/                 # Pydantic モデル（リクエスト・レスポンス）
│   ├── db/
│   │   ├── engine.py            # SQLAlchemy エンジン・セッション
│   │   └── models/              # ORM モデル
│   ├── dependencies/            # FastAPI 依存注入（シングルトン管理）
│   ├── validators/              # 入力バリデーション
│   ├── middlewares/             # CORS・ロギングミドルウェア
│   └── utils/                   # 共通ユーティリティ
├── alembic/                     # DB マイグレーション
├── tests/
│   ├── unit/                    # 単体テスト
│   └── integration/             # 統合テスト（PostgreSQL testcontainers）
└── pyproject.toml
```

**依存の方向**: `routes → controllers → services → repositories`  
`services → infrastructure`（外部ライブラリラッパー）

---

## 8. DB・マイグレーション

### テーブル設計

**`jobs` テーブル**

| カラム | 型 | 説明 |
| --- | --- | --- |
| `job_id` | `TEXT` (PK) | ランダム生成 ID |
| `status` | `VARCHAR(16)` | `queued` / `running` / `completed` / `failed` |
| `progress` | `INTEGER` | 進捗率（0–100） |
| `message` | `TEXT` | 状態メッセージ |
| `filename` | `TEXT` | 元ファイル名 |
| `created_at` | `TIMESTAMPTZ` | 作成日時（インデックスあり） |
| `started_at` | `TIMESTAMPTZ` | 処理開始日時 |
| `completed_at` | `TIMESTAMPTZ` | 完了日時 |
| `applied_operations` | `JSONB` | 適用した操作の配列 |
| `result` | `JSONB` | 処理結果（完了時のみ） |
| `error_message` | `TEXT` | エラーメッセージ（失敗時のみ） |

### マイグレーションコマンド

```bash
# 最新に適用
PYTHONPATH=src poetry run alembic upgrade head

# 1つ戻す
PYTHONPATH=src poetry run alembic downgrade -1

# 現在のリビジョン確認
PYTHONPATH=src poetry run alembic current

# 新規マイグレーション作成（自動生成）
PYTHONPATH=src poetry run alembic revision --autogenerate -m "説明"
```

> SQLite は非対応です（JSONB カラムのため PostgreSQL が必須）。

---

## 9. テスト

```bash
cd backend

# 全テスト実行
poetry run task test

# 単体テストのみ
poetry run pytest tests/unit/

# 統合テストのみ（Docker が必要）
poetry run pytest tests/integration/

# カバレッジ付きで実行
poetry run pytest --cov=app
```

**テスト構成

| 種別 | 内容 |
| --- | --- |
| 単体テスト (`tests/unit/`) | コントローラー・サービス・バリデーター・スキーマ・インフラ層の各モジュール |
| 統合テスト (`tests/integration/`) | PostgreSQL（testcontainers）を使った API エンドポイントの E2E テスト |

---

## 10. セキュリティ

| 対策 | 実装箇所 |
| --- | --- |
| ファイルサイズ上限（20 MB） | `validators/image_validator.py` |
| 画像形式チェック（Content-Type + Pillow verify） | `validators/image_validator.py` |
| Decompression Bomb 対策 | `validators/image_validator.py`（`Image.DecompressionBombError` 捕捉） |
| Pydantic による入力バリデーション | `schemas/image.py`（`extra="forbid"` でスキーマ外フィールドを拒否） |
| CORS 制限 | `middlewares/cors_middleware.py`（環境変数で許可オリジンを指定） |
| 環境変数による設定分離 | `core/config.py`（シークレットをコードに含まない） |

---

## 11. 主要パッケージとその選定理由

| パッケージ | 選定理由 |
| --- | --- |
| **FastAPI** | 型アノテーションからの自動バリデーション・OpenAPI 生成・非同期対応。`pydantic-settings` との相性も良い |
| **pydantic-settings** | 環境変数を型安全に扱える。`.env` ファイルの自動読み込みとバリデーションが一体化 |
| **SQLAlchemy + Alembic** | Python の事実上の標準 ORM。Alembic でスキーマ変更を宣言的に管理 |
| **psycopg（v3）** | SQLAlchemy 2.0 と相性の良い非同期対応の PostgreSQL ドライバ |
| **OpenCV** | 画像処理の業界標準。GaussianBlur・Canny・輝度調整等を高速に処理 |
| **RapidOCR** | onnxruntime ベースで依存が軽量。CPU のみで日本語 OCR が動作 |
| **openai SDK** | OpenAI 互換 API（LM Studio）への接続に使用。ローカル LLM を本番 LLM と差し替え可能な設計 |
| **testcontainers** | 統合テストで実際の PostgreSQL コンテナを起動し、モックなしで DB 層をテスト |
