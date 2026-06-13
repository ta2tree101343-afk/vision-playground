# Orval 移行設計

**日付**: 2026-06-13
**対象**: `smart-image-studio/frontend`

---

## 目的

手書きの TypeScript 型定義（`shared/types/api.ts`）と Zod スキーマ（`shared/schemas/api.schemas.ts`）を、Orval による OpenAPI コード生成に置き換える。バックエンドの Pydantic モデルを変更した際に、フロントエンドの型・スキーマが自動で追従できる体制を整える。

---

## 設計方針

- **アプローチ**: Orval が型定義 + Zod スキーマのみを生成。HTTP 層（`apiClient.ts`）と API 関数（`jobApi.ts`）は手書きを維持する。
- **OpenAPI スペック**: 静的ファイル（`docs/openapi.json`）をリポジトリにコミットし、バックエンド起動不要で codegen できる体制にする。
- **CI 保護**: スペックまたは Pydantic モデルの変更を再生成せずに PR を出すと CI が落ちる。

---

## ファイル構成（変更後）

```
smart-image-studio/
├── docs/
│   └── openapi.json                         ← NEW: 静的スペック（コミット対象）
│
├── backend/
│   ├── scripts/
│   │   └── export_openapi.py                ← NEW: スペックエクスポートスクリプト
│   └── pyproject.toml                       ← MODIFIED: export-openapi タスク追加
│
└── frontend/
    ├── orval.config.ts                      ← NEW: Orval 設定
    ├── package.json                         ← MODIFIED: codegen スクリプト追加
    └── src/shared/
        ├── api/
        │   ├── __generated__/
        │   │   ├── api.types.ts             ← NEW: 生成（型定義）
        │   │   └── api.schemas.ts           ← NEW: 生成（Zod スキーマ）
        │   ├── apiClient.ts                 ← 変更なし
        │   └── jobApi.ts                    ← import パス更新のみ
        ├── types/
        │   └── api.ts                       ← DELETE
        └── schemas/
            └── api.schemas.ts               ← DELETE
```

---

## 役割分担

| ファイル | 管理 | 役割 |
|---|---|---|
| `docs/openapi.json` | 手動更新（export-openapi タスク） | スキーマ契約の単一ソース |
| `__generated__/api.types.ts` | Orval 生成 | TypeScript 型定義 |
| `__generated__/api.schemas.ts` | Orval 生成 | Zod スキーマ |
| `shared/api/apiClient.ts` | 手書き | HTTP アダプタ（変更なし） |
| `shared/api/jobApi.ts` | 手書き | API 関数（import パス更新のみ） |
| `shared/lib/processResult.ts` | 手書き | URL 正規化（変更なし） |

`__generated__/` はコミット対象（`.gitignore` しない）。静的スペックから生成するため、生成物も確定的に管理する。

---

## Orval 設定

```ts
// frontend/orval.config.ts
import { defineConfig } from 'orval';

export default defineConfig({
  // TypeScript 型定義の生成
  apiTypes: {
    input: '../docs/openapi.json',
    output: {
      mode: 'single',
      target: './src/shared/api/__generated__/api.types.ts',
      // client 指定は生成結果を確認して決定する（呼び出し関数が混入しないよう調整）
      override: {
        useTypeOverInterfaces: true,
      },
    },
  },
  // Zod スキーマの生成
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

**注意**: `client` の指定はバージョン依存がある。生成後に `api.types.ts` に fetch 呼び出し関数が混入していないか目視確認し、混入していれば設定を調整する。

---

## npm スクリプト

```json
// frontend/package.json
"codegen": "orval --config orval.config.ts"
```

---

## OpenAPI スペックのエクスポート

```python
# backend/scripts/export_openapi.py
import json
import sys
from app.main import app

sys.stdout.buffer.write(
    (json.dumps(app.openapi(), ensure_ascii=False, indent=2) + "\n").encode("utf-8")
)
```

```toml
# backend/pyproject.toml [tool.taskipy.tasks]
export-openapi = "python scripts/export_openapi.py > ../docs/openapi.json"
```

バックエンドの起動は不要。FastAPI アプリを import するだけでスペックを取得できる。

末尾改行を Python 側で固定することで、ローカル（macOS）と CI（Linux）間の改行コード差異による `git diff` 誤検知を防ぐ。

---

## CI チェック

```yaml
# .github/workflows/ci.yml（追加ジョブ）
- name: Check generated files are up to date
  run: |
    cd smart-image-studio/backend && poetry run task export-openapi
    cd smart-image-studio/frontend && npm run codegen
    git diff --exit-code
```

このチェックにより「Pydantic モデルを変更したが再生成を忘れた PR」を機械が検知して落とす。

---

## 更新フロー（スキーマ変更時）

```
1. バックエンドの Pydantic モデルを変更
2. cd backend && poetry run task export-openapi  →  docs/openapi.json を更新
3. cd frontend && npm run codegen                →  __generated__/ を更新
4. 型エラーがあれば修正してコミット
```

---

## 移行手順

```
0. schemas/api.schemas.ts に .refine()/.transform() がないことを確認
   → 確認済み: なし。ステップ 8 で削除可能。

1. orval を devDependency としてインストール

2. backend/scripts/export_openapi.py を作成
   pyproject.toml に export-openapi タスクを追加
   poetry run task export-openapi を実行 → docs/openapi.json を生成

3. CI ジョブを追加（← 移行 PR 自体も保護するため前倒し）

4. frontend/orval.config.ts を作成

5. npm run codegen を実行 → __generated__/ を確認
   - api.types.ts に fetch 呼び出し関数が混入していないか目視
   - ImageProcessJob が discriminated union になっているか確認
     → なっていない場合は shared/types/api.ts（手書き）で上書き re-export する

6. jobApi.ts・processResultStore.ts・pipelineStorage.ts のインポートパスを更新
   @shared/types/api → @shared/api/__generated__/api.types
   @shared/schemas/api.schemas → @shared/api/__generated__/api.schemas

7. npx tsc --noEmit で型エラーを潰す

8. 旧ファイルを削除
   - src/shared/types/api.ts
   - src/shared/schemas/api.schemas.ts
```

---

## 既知の劣化（許容）

| 項目 | 現状 | 移行後 | 影響 |
|---|---|---|---|
| `.strict()` | `operationParametersSchema` に適用 | Orval が再現しない可能性大 | 余分フィールドを黙って通過するが、型エラーにはならない |
| 数値制約 | `.min()/.max()/.int()` で定義 | Pydantic バリデータが OpenAPI に出力されていれば再現される | Orval 生成物を確認して判断 |

---

## 判断基準：discriminated union が生成されなかった場合

FastAPI が `anyOf + discriminator` で出力しない構成の場合、Orval は flat な interface を生成する。
このとき `job.status` による型絞り込みが壊れるため、以下の対処を取る：

```ts
// src/shared/types/api.ts（手書きで維持）
export type { ... } from '@shared/api/__generated__/api.types';
export type ImageProcessJob = /* 手書きの discriminated union */ ...;
```

Orval 生成の型を import しつつ、`ImageProcessJob` だけ上書き re-export する。
