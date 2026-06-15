# Smart Image Studio

画像をアップロードし、処理パイプラインを組み立て、元画像と加工後画像を比較できる Web アプリケーションです。

---

## 1. プロジェクト概要

**何を作るか**  
ローカルで動く画像処理スタジオです。グレースケール・ブラー・エッジ検出などの古典的な CV 処理から、OCR・物体検出・背景除去・AI キャプション生成まで、複数の処理をノードフローで繋いでパイプライン実行できます。

**誰のためのものか**  

- 画像処理の実験・比較を手軽に行いたい開発者・研究者
- OpenCV / ローカル LLM を使った処理を UI から試したいエンジニア
- フロント（FSD）・バック（レイヤードアーキテクチャ）・非同期ジョブキューの参照実装として学びたい人

**現在のスコープ**  
MVP としてローカル環境での動作を優先しています。外部クラウドサービスへの依存はなく、LLM もローカル LM Studio 経由で利用します。

---

## 2. システム全体構成図

```text
ブラウザ
  │  HTTP (port 5173)
  ▼
┌─────────────────────────────────────────────────┐
│  Frontend  (React / Vite)                        │
│  ・ノードフローパイプラインエディタ               │
│  ・非同期ジョブ投入 & 1.5 秒ポーリング           │
│  ・処理結果の Before / After 比較ビューア        │
└──────────────────┬──────────────────────────────┘
                   │  HTTP REST (port 8000)
                   ▼
┌─────────────────────────────────────────────────┐
│  Backend  (FastAPI / Python)                     │
│  ・同期処理  POST /api/images/process            │
│  ・非同期ジョブ  POST /api/images/jobs           │
│  ・画像処理ワーカー（インプロセスキュー）         │
│    OpenCV / RapidOCR / MobileNet-SSD / LM Studio │
└──────────┬──────────────────┬───────────────────┘
           │  SQL (port 5433)  │  ローカルファイルシステム
           ▼                   ▼
    PostgreSQL 16           uploads/
    ・jobs テーブル         ・originals/
    ・JSONB 結果保存        ・processed/
```

> **クラウド連携について**  
> 現時点ではすべてローカル稼働です。`SMART_IMAGE_STUDIO_PUBLIC_BASE_URL` を本番ホストに向けることで、ストレージを S3 等に差し替えて本番展開する設計になっています。

---

## 3. リポジトリ構成

```text
smart-image-studio/               ← このディレクトリがモノレポルート
├── README.md                     ← 本ファイル
├── docker-compose.yml            ← 全サービス一括起動
├── docs/
│   └── openapi.json              ← OpenAPI スナップショット（コード生成の入力）
├── frontend/                     ← React アプリ（詳細は frontend/README.md）
│   ├── Dockerfile
│   ├── .env.example
│   ├── orval.config.ts           ← Orval コード生成設定
│   ├── vite.config.ts
│   └── src/                      ← Feature-Sliced Design
│       ├── app/                  ← エントリーポイント・ルーティング
│       ├── pages/                ← StudioPage, ResultPage
│       ├── widgets/              ← UI ブロック（キャンバス・パネル等）
│       ├── features/             ← image-upload, pipeline-edit, job-tracking
│       ├── entities/             ← image, job, operation, pipeline
│       └── shared/               ← api, config, lib, types, ui
└── backend/                      ← FastAPI アプリ（詳細は backend/README.md）
    ├── Dockerfile
    ├── .env.example
    ├── pyproject.toml
    ├── alembic/                  ← DB マイグレーション
    └── src/app/
        ├── routes/               ← HTTP バインディング
        ├── controllers/          ← リクエスト解析・レスポンス整形
        ├── services/             ← ビジネスロジック
        ├── repositories/         ← DB 永続化（SQLAlchemy）
        ├── infrastructure/       ← OpenCV, RapidOCR, MobileNet-SSD, LLM, Storage, Queue
        ├── schemas/              ← Pydantic スキーマ
        ├── core/                 ← 設定・定数・例外
        └── main.py
```

---

## 4. クイックスタート

### Docker（推奨）— 3 コマンドで全サービスを起動

```bash
# 1. 環境変数ファイルを準備（初回のみ）
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 2. ビルド＆起動
docker compose up --build

# 3. ブラウザでアクセス
#   UI:        http://localhost:5173
#   API Docs:  http://localhost:8000/docs
```

以降の起動は `docker compose up` のみで OK です。

```bash
docker compose down      # 停止（データは保持）
docker compose down -v   # データも含めてリセット
```

### ローカル起動（Docker なし）

**事前準備**: Python 3.13 / Poetry / Node 22 / PostgreSQL 16 が必要です。

```bash
# バックエンド
cd backend
cp .env.example .env
# .env の DATABASE_URL を自分の PostgreSQL に合わせて編集
poetry install
PYTHONPATH=src poetry run alembic upgrade head
poetry run task dev          # :8000 で起動

# フロントエンド（別ターミナル）
cd frontend
cp .env.example .env
npm install
npm run dev                  # :5173 で起動
```

### ML モデルの手動配置（物体検出を使う場合）

MobileNet-SSD の重みファイルは `.gitignore` で除外されているため、初回のみ手動でダウンロードが必要です。

```bash
# mobilenet_iter_73000.caffemodel を以下のパスに配置
backend/src/app/assets/ml_models/mobilenet_iter_73000.caffemodel
```

ダウンロード元: <https://github.com/chuanqi305/MobileNet-SSD>

---

## 5. 各コンポーネントへのリンク

| コンポーネント | README | 主要トピック |
| --- | --- | --- |
| **Frontend** | [frontend/README.md](./frontend/README.md) | FSD 設計・Orval コード生成・状態管理・テスト |
| **Backend** | [backend/README.md](./backend/README.md) | レイヤードアーキテクチャ・API 仕様・DB マイグレーション・テスト |

---

## 6. 開発フロー

### ブランチ運用

| ブランチ | 用途 |
| --- | --- |
| `main` | 常にデプロイ可能な状態を維持 |
| `feat/*` | 機能追加 |
| `fix/*` | バグ修正 |
| `chore/*` | 依存更新・設定変更等 |

### PR ルール

- `main` への直接 push は禁止。PR 経由でマージします。
- PR マージ前に CI（後述）がすべてグリーンであることを確認してください。
- 新しいコードを実装したら `feature-dev:code-reviewer` エージェントでレビューを実施し、指摘事項をすべて修正してからマージします。

### CI（GitHub Actions）

`.github/workflows/check-generated.yml` が push / PR ごとに実行されます。

```text
1. Python 3.13 + Poetry → バックエンド依存インストール
2. Node 22 → フロントエンド依存インストール（npm install）
3. poetry run task export-openapi → docs/openapi.json を再生成
4. npm run codegen → __generated__/ を再生成
5. git diff --exit-code で生成ファイルに差分がないことを検証
```

**openapi.json または生成ファイルに差分が出た場合**: ローカルで `poetry run task export-openapi` と `npm run codegen` を実行してコミットに含めてください。

### ローカルでのコード品質チェック

```bash
# バックエンド
cd backend
poetry run task format     # フォーマット（ruff）
poetry run task lint       # Lint（ruff）
poetry run task typecheck  # 型検査（mypy）
poetry run task test       # テスト（pytest）

# フロントエンド
cd frontend
npm run lint               # ESLint
npx tsc --noEmit           # 型検査
npm run test               # Vitest
```

---

## 7. ライセンス / 補足

- **ライセンス**: 未設定（個人プロジェクト）
- `docs/openapi.json` は Orval のコード生成入力です。削除しないでください。
- バックエンドの PostgreSQL 接続には `psycopg`（v3）を使用しており、SQLite は非対応です（JSONB カラムのため）。
- LLM 機能はローカルの LM Studio（OpenAI 互換 API）を使用します。`SMART_IMAGE_STUDIO_LLM_API_BASE_URL` で接続先を変更できます。
