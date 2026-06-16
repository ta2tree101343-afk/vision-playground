# Smart Image Studio

画像をアップロードし、処理パイプラインを組み立て、元画像と加工後画像を比較できる Web アプリです。
フロントエンド / バックエンドを責務分離したモノレポ構成です。

---

## ディレクトリ構成

```text
smart-image-studio/
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
│       ├── features/                 # image-upload, job-tracking, pipeline-edit
│       ├── entities/                 # image, job, pipeline ドメインオブジェクト
│       └── shared/                   # api, config, lib, types, ui
└── backend/
    ├── .env.example
    ├── Dockerfile
    ├── pyproject.toml
    ├── alembic/                      # DB マイグレーション
    └── src/app/
        ├── assets/ml_models/         # MobileNetSSD_deploy.prototxt（caffemodel は要別途 DL）
        ├── controllers/              # リクエスト解析・レスポンス整形
        ├── core/                     # config, constants, exceptions, logging
        ├── db/                       # SQLAlchemy engine, models
        ├── dependencies/             # @lru_cache シングルトンファクトリ
        ├── infrastructure/           # image_processing, object_detection, ocr, llm, storage, queue
        ├── middlewares/              # CORS, ロギング
        ├── repositories/             # job_repository (SQLAlchemy)
        ├── routes/                   # HTTP バインディング
        ├── schemas/                  # Pydantic スキーマ
        ├── services/                 # ビジネスロジック
        ├── validators/               # リクエストバリデーション
        └── main.py
```

---

## 主な機能

| カテゴリ | 機能 |
| --- | --- |
| **画像処理** | グレースケール・ブラー・シャープン・ノイズ除去・エッジ検出・明度/コントラスト調整・背景除去 |
| **AI 解析** | OCR（日本語対応）・物体検出（MobileNet-SSD）・AI キャプション生成 |
| **パイプライン** | ステップ追加・並び替え・削除・パラメータ調整・ドラフト保存・プリセット管理 |
| **ジョブ管理** | 非同期処理・ポーリングによるステータス追跡・処理履歴 |
| **比較表示** | Before/After 並列表示・差分モード・処理前後ヒストグラム |
| **AI 可視化** | 物体検出 bounding box・OCR 認識位置・AI キャプション表示 |

---

## 技術スタック

### Frontend

| カテゴリ | 技術 |
| --- | --- |
| フレームワーク | React 18 / TypeScript |
| スタイリング | Tailwind CSS |
| ビルド | Vite |
| 設計 | Feature-Sliced Design（FSD） |
| API 型生成 | Orval（OpenAPI → TypeScript / Zod） |

### Backend

| カテゴリ | 技術 |
| --- | --- |
| フレームワーク | FastAPI / Python 3.13 |
| パッケージ管理 | Poetry |
| DB | PostgreSQL 16（SQLAlchemy + Alembic） |
| 画像処理 | OpenCV / Pillow |
| OCR | RapidOCR |
| 物体検出 | MobileNet-SSD（ONNX） |
| LLM | OpenAI SDK（LM Studio 互換） |

---

## Docker での起動（推奨）

### 前準備（初回のみ）

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

> **物体検出モデルについて**
> `mobilenet_iter_73000.caffemodel` は `.gitignore` で除外されています。
> 初回は <https://github.com/chuanqi305/MobileNet-SSD> からダウンロードし、
> `backend/src/app/assets/ml_models/` に配置してください。
> 未配置の場合、`object_detection` 操作は HTTP 503 を返します（他の処理は正常動作します）。

### 起動

```bash
cd smart-image-studio
docker compose up --build  # 初回 or Dockerfile 変更時
docker compose up          # 通常起動
```

### 停止

```bash
docker compose down    # 停止（named volume は保持）
docker compose down -v # named volume も含めて完全削除
```

起動後のアクセス先:

| サービス | URL |
| --- | --- |
| Frontend | <http://localhost:5173> |
| Backend API | <http://localhost:8000> |
| OpenAPI Docs | <http://localhost:8000/docs> |
| Health check | <http://localhost:8000/health> |

---

## ローカル起動手順

### Backend の起動

```bash
cd backend
poetry install
cp .env.example .env
PYTHONPATH=src poetry run alembic upgrade head
poetry run task dev
```

### Frontend の起動

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

---

## 実装上のポイント

- **Frontend**: Feature-Sliced Design（FSD）で 6 層（app / pages / widgets / features / entities / shared）に責務分離
- **Backend**: `route → controller → service → repository` の層構造。`infrastructure/` が外部ライブラリをラップ
- **ジョブ永続化**: PostgreSQL（SQLAlchemy + Alembic）。JSONB 型を使うため SQLite 非対応。再起動時は `mark_interrupted_jobs()` で自動リカバリ
- **型安全**: Orval で OpenAPI 仕様から TypeScript 型と Zod スキーマを自動生成。CI で生成ファイルの差分を検出
- **画像バリデーション**: ファイルサイズ・形式・Decompression Bomb を Frontend / Backend の双方でチェック

---

## 詳細ドキュメント

| ドキュメント | 内容 |
| --- | --- |
| [frontend/README.md](./frontend/README.md) | FSD 設計・状態管理・API 連携・テスト |
| [backend/README.md](./backend/README.md) | API 仕様・DB 設計・環境変数・テスト |

---

## 今後の拡張案

- ユーザーごとの作業セッション管理
- クラウドストレージへの保存対応
- 処理プリセットのサーバーサイド管理・共有
