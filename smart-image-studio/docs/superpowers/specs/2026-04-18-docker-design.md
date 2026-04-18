# Docker 対応 設計

**日付:** 2026-04-18  
**対象:** `smart-image-studio/` 全体

## 概要

frontend (Vite + React) と backend (FastAPI + Poetry) を Docker Compose でまとめて起動できるようにする。
開発用途のため、ソースをボリュームマウントしてホットリロードを実現する。

## 方針

- アプローチ A: `docker-compose.yml` + 専用 `Dockerfile` 2枚構成
- backend と frontend それぞれに `Dockerfile` と `.dockerignore` を用意
- named volume で `.venv` / `node_modules` を永続化し、毎回の再インストールを避ける
- backend の healthcheck を frontend の `depends_on` に連携させ、起動順序を制御する

## ファイル構成

| ファイル | 操作 | 内容 |
|---|---|---|
| `smart-image-studio/docker-compose.yml` | 新規作成 | サービス定義・ボリューム・healthcheck |
| `smart-image-studio/backend/Dockerfile` | 新規作成 | Python 3.13-slim + Poetry |
| `smart-image-studio/backend/.dockerignore` | 新規作成 | .venv / .env / uploads 除外 |
| `smart-image-studio/frontend/Dockerfile` | 新規作成 | node:22-alpine + npm |
| `smart-image-studio/frontend/.dockerignore` | 新規作成 | node_modules / dist / .env 除外 |
| `smart-image-studio/.gitignore` | 修正 | backend/.env / frontend/.env を追記 |

## `backend/Dockerfile`

```dockerfile
FROM python:3.13-slim

ENV POETRY_VIRTUALENVS_IN_PROJECT=true

RUN pip install poetry

WORKDIR /app

COPY pyproject.toml poetry.lock poetry.toml ./
RUN poetry install --no-root

COPY . .

CMD ["poetry", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

- `POETRY_VIRTUALENVS_IN_PROJECT=true` で `.venv/` をプロジェクト内に作成し、named volume と一致させる
- `--no-root` で依存のみインストール（アプリ自体はボリュームマウントで参照）
- `--reload` でソース変更を自動検知

## `backend/.dockerignore`

```
.venv/
__pycache__/
*.py[cod]
.env
uploads/originals/
uploads/processed/
```

## `frontend/Dockerfile`

```dockerfile
FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .

CMD ["npm", "run", "dev", "--", "--host"]
```

- `--host` で Vite をコンテナ外からアクセス可能にする

## `frontend/.dockerignore`

```
node_modules/
dist/
.env.local
.env
```

## `docker-compose.yml`

```yaml
services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    volumes:
      - ./backend:/app
      - backend_venv:/app/.venv
    env_file:
      - ./backend/.env
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/health', timeout=2)"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    volumes:
      - ./frontend:/app
      - frontend_node_modules:/app/node_modules
    env_file:
      - ./frontend/.env
    depends_on:
      backend:
        condition: service_healthy

volumes:
  backend_venv:
  frontend_node_modules:
```

- `backend_venv` / `frontend_node_modules` を named volume で永続化
- `service_healthy` で backend の healthcheck 完了後に frontend を起動
- healthcheck は `urllib.request` を使用（curl 不要、python:3.13-slim に標準で含まれる）
- `start_period: 10s` で Poetry / uvicorn 起動の猶予を確保

## `.gitignore` 追記内容

```
backend/.env
frontend/.env
frontend/.env.local
```

## 起動方法

```bash
cd smart-image-studio

# 初回 or Dockerfile 変更時
docker compose up --build

# 通常起動
docker compose up

# 停止（named volume は保持）
docker compose down

# named volume も含めて完全削除
docker compose down -v
```

## アクセス先

| サービス | URL |
|---|---|
| frontend | http://localhost:5173 |
| backend | http://localhost:8000 |
| health check | http://localhost:8000/health |

## 完了条件

- `docker compose up --build` でエラーなく両サービスが起動する
- http://localhost:5173 で frontend が表示される
- http://localhost:8000/health が `{"status":"ok"}` を返す
- backend のソース変更が uvicorn に自動反映される
- frontend のソース変更が Vite に自動反映される
