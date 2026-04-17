# Poetry 移行 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `backend/requirements.txt` + pip 運用を Poetry に完全移行し、開発用ツール（ruff / mypy / pytest）を `pyproject.toml` に集約する。

**Architecture:** `backend/poetry.toml` で仮想環境をプロジェクト内 (`.venv/`) に固定し、`backend/pyproject.toml` にランタイム依存と開発用依存をまとめる。`requirements.txt` は削除し、README のセットアップ・起動手順を Poetry 向けに書き換える。

**Tech Stack:** Poetry, ruff, mypy, pytest, pytest-cov

---

## ファイルマップ

| ファイル | 操作 | 内容 |
|---|---|---|
| `smart-image-studio/backend/poetry.toml` | 新規作成 | virtualenvs.in-project = true |
| `smart-image-studio/backend/pyproject.toml` | 新規作成 | 全依存 + ツール設定 |
| `smart-image-studio/backend/poetry.lock` | 自動生成 | poetry install で生成 |
| `smart-image-studio/backend/requirements.txt` | 削除 | — |
| `smart-image-studio/README.md` | 修正 | backend セットアップ・起動手順 |

---

### Task 1: `poetry.toml` を作成する

**Files:**
- Create: `smart-image-studio/backend/poetry.toml`

- [ ] **Step 1: `poetry.toml` を作成する**

`smart-image-studio/backend/poetry.toml` を以下の内容で作成する：

```toml
[virtualenvs]
in-project = true
```

- [ ] **Step 2: 内容を確認する**

```bash
cat smart-image-studio/backend/poetry.toml
```

期待出力：

```
[virtualenvs]
in-project = true
```

- [ ] **Step 3: コミットする**

```bash
git add smart-image-studio/backend/poetry.toml
git commit -m "chore: add poetry.toml to use in-project virtualenv"
```

---

### Task 2: `pyproject.toml` を作成する

**Files:**
- Create: `smart-image-studio/backend/pyproject.toml`

- [ ] **Step 1: `pyproject.toml` を作成する**

`smart-image-studio/backend/pyproject.toml` を以下の内容で作成する：

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
ignore_missing_imports = true

[tool.pytest.ini_options]
testpaths = ["tests"]

[build-system]
requires = ["poetry-core"]
build-backend = "poetry.core.masonry.api"
```

> **注意:** `ignore_missing_imports = true` は、サードパーティ製パッケージに型スタブがない場合のエラーを抑制するため設定する。

- [ ] **Step 2: コミットする**

```bash
git add smart-image-studio/backend/pyproject.toml
git commit -m "chore: add pyproject.toml for Poetry"
```

---

### Task 3: `poetry install` を実行して `poetry.lock` を生成する

**Files:**
- Auto-generated: `smart-image-studio/backend/poetry.lock`

- [ ] **Step 1: `poetry install` を実行する**

```bash
cd smart-image-studio/backend
poetry install
```

期待動作：
- `backend/.venv/` が作成される
- 全依存パッケージがインストールされる
- `poetry.lock` が生成される

- [ ] **Step 2: 仮想環境の場所を確認する**

```bash
poetry env info --path
```

期待出力（末尾が `.venv` のパス）：

```
/path/to/smart-image-studio/backend/.venv
```

- [ ] **Step 3: `poetry.lock` をコミットする**

```bash
git add smart-image-studio/backend/poetry.lock
git commit -m "chore: add poetry.lock"
```

---

### Task 4: 開発ツールの動作を確認する

**Files:**
- 変更なし（確認のみ）

- [ ] **Step 1: `ruff format` を実行する**

```bash
cd smart-image-studio/backend
poetry run ruff format app/
```

期待出力例：

```
1 file reformatted, 5 files left unchanged
```

（エラーがなければ OK。reformatted が出た場合は続けて Step 2 へ）

- [ ] **Step 2: フォーマット変更があった場合はコミットする**

変更があった場合のみ実行する：

```bash
git add smart-image-studio/backend/app/
git commit -m "style: apply ruff format"
```

- [ ] **Step 3: `ruff check` を実行する**

```bash
cd smart-image-studio/backend
poetry run ruff check app/
```

期待出力：エラーなし（何も出力されないか `All checks passed.`）  
エラーが出た場合は `poetry run ruff check --fix app/` で自動修正してからコミットする。

- [ ] **Step 4: lint 修正があった場合はコミットする**

変更があった場合のみ実行する：

```bash
git add smart-image-studio/backend/app/
git commit -m "style: apply ruff check --fix"
```

- [ ] **Step 5: `mypy` を実行する**

```bash
cd smart-image-studio/backend
poetry run mypy app/
```

期待出力例：

```
Success: no issues found in N source files
```

エラーが出た場合は内容を確認する。型エラーが実際の問題を指している場合は修正してコミットする。`strict = true` に起因する過剰なエラーが多い場合は、`pyproject.toml` の `[tool.mypy]` に `strict = false` を設定してから再実行する（後で段階的に有効化）。

- [ ] **Step 6: `pytest` を実行する**

```bash
cd smart-image-studio/backend
poetry run pytest
```

期待出力（テストファイルがまだない場合）：

```
no tests ran
```

または

```
collected 0 items
```

エラーがなければ OK。

---

### Task 5: `requirements.txt` を削除する

**Files:**
- Delete: `smart-image-studio/backend/requirements.txt`

- [ ] **Step 1: `requirements.txt` を削除する**

```bash
rm smart-image-studio/backend/requirements.txt
```

- [ ] **Step 2: 削除を確認する**

```bash
ls smart-image-studio/backend/
```

`requirements.txt` が表示されないことを確認する。

- [ ] **Step 3: コミットする**

```bash
git add smart-image-studio/backend/requirements.txt
git commit -m "chore: remove requirements.txt (replaced by pyproject.toml)"
```

---

### Task 6: README のセットアップ・起動手順を更新する

**Files:**
- Modify: `smart-image-studio/README.md`

- [ ] **Step 1: README の backend セットアップ手順を書き換える**

`smart-image-studio/README.md` の `### 2. backend` セクションを以下に差し替える：

**変更前:**

```markdown
### 2. backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```
```

**変更後:**

```markdown
### 2. backend

```bash
cd backend
poetry install
cp .env.example .env
```
```

- [ ] **Step 2: README の backend 起動手順を書き換える**

`smart-image-studio/README.md` の `### backend を起動` セクションを以下に差し替える：

**変更前:**

```markdown
### backend を起動

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```
```

**変更後:**

```markdown
### backend を起動

```bash
cd backend
poetry run uvicorn app.main:app --reload --port 8000
```
```

- [ ] **Step 3: README の技術スタック欄に Poetry を追記する**

`### backend` の技術スタック一覧に `Poetry` を追加する：

**変更前:**

```markdown
### backend

- Python
- FastAPI
```

**変更後:**

```markdown
### backend

- Python
- Poetry
- FastAPI
```

- [ ] **Step 4: コミットする**

```bash
git add smart-image-studio/README.md
git commit -m "docs: update README setup/run instructions for Poetry"
```

---

## 完了条件チェックリスト

- [ ] `backend/.venv/` が存在する
- [ ] `backend/poetry.lock` が存在する
- [ ] `backend/requirements.txt` が存在しない
- [ ] `poetry run uvicorn app.main:app --reload --port 8000` でサーバーが起動する（`http://localhost:8000/health` が `{"status":"ok"}` を返す）
- [ ] `poetry run ruff format app/` がエラーなく完了する
- [ ] `poetry run ruff check app/` がエラーなく完了する
- [ ] `poetry run mypy app/` がエラーなく完了する
- [ ] `poetry run pytest` がエラーなく完了する
- [ ] README のセットアップ・起動手順に `pip` や `venv` コマンドが残っていない
