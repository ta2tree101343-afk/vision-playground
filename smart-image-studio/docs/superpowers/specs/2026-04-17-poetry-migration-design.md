# Poetry 移行設計

**日付:** 2026-04-17  
**対象:** `smart-image-studio/backend`

## 概要

`requirements.txt` + `pip` による依存管理を Poetry に完全移行する。  
開発用依存（format / lint / test）も `pyproject.toml` に集約し、`requirements.txt` は削除する。

## 方針

- アプローチ A: `pyproject.toml` のみに完全移行
- `requirements.txt` は削除（CI なし・ローカルのみの構成のため二重管理不要）
- 仮想環境は `backend/.venv/` に固定（`poetry.toml` で設定）

## 変更ファイル

| ファイル | 操作 |
|---|---|
| `backend/pyproject.toml` | 新規作成 |
| `backend/poetry.toml` | 新規作成 |
| `backend/requirements.txt` | 削除 |
| `smart-image-studio/README.md` | セットアップ・起動手順を Poetry 向けに更新 |

## `pyproject.toml` 内容

```toml
[tool.poetry]
name = "smart-image-studio-backend"
version = "0.1.0"
description = ""
authors = []
packages = []

[tool.poetry.dependencies]
python = "^3.13"
fastapi = ">=0.115,<1.0"
uvicorn = {extras = ["standard"], version = ">=0.30,<1.0"}
python-multipart = ">=0.0.9,<1.0"
pillow = ">=10.4,<12.0"
opencv-python = ">=4.10,<5.0"
numpy = ">=1.26,<3.0"
pydantic-settings = ">=2.4,<3.0"
rapidocr-onnxruntime = ">=1.2,<2.0"

[tool.poetry.group.dev.dependencies]
ruff = "*"
mypy = "*"
pytest = "*"
pytest-cov = "*"

[tool.ruff]
line-length = 88
target-version = "py313"

[tool.ruff.lint]
select = ["E", "F", "I"]

[tool.mypy]
python_version = "3.13"
strict = true

[tool.pytest.ini_options]
testpaths = ["tests"]

[build-system]
requires = ["poetry-core"]
build-backend = "poetry-core.backends.ProjectBackend"
```

## `poetry.toml` 内容

```toml
[virtualenvs]
in-project = true
```

## README 更新後のセットアップ手順

```bash
cd backend
poetry install
cp .env.example .env
```

## README 更新後の起動手順

```bash
cd backend
poetry run uvicorn app.main:app --reload --port 8000
```

## 完了条件

- `poetry install` が `backend/.venv/` に仮想環境を作成する
- `poetry run uvicorn app.main:app --reload --port 8000` でバックエンドが起動する
- `poetry run ruff format app/`、`poetry run ruff check app/`、`poetry run mypy app/`、`poetry run pytest` がそれぞれ実行できる
- `requirements.txt` が存在しない
