# Smart Image Studio — Frontend

React + TypeScript で構築した画像処理スタジオの UI です。
ノードフロー形式のパイプラインエディタ、非同期ジョブ追跡、処理結果の比較ビューアを提供します。

---

## 1. プロジェクト概要

| 項目 | 内容 |
| --- | --- |
| 言語 | TypeScript 5.6 |
| フレームワーク | React 18 |
| スタイリング | Tailwind CSS 3 |
| ビルドツール | Vite 5 |
| 設計 | Feature-Sliced Design（FSD） |
| API 型生成 | Orval（OpenAPI → TypeScript / Zod） |

---

## 2. 使用技術

| カテゴリ | ライブラリ | バージョン |
| --- | --- | --- |
| UI フレームワーク | React + ReactDOM | ^18.3 |
| ドラッグ＆ドロップ | @dnd-kit/core, sortable, utilities | ^6 / ^10 / ^3 |
| スキーマバリデーション | Zod | ^4 |
| スタイリング | Tailwind CSS + PostCSS + Autoprefixer | ^3 / ^8 / ^10 |
| ビルド | Vite + @vitejs/plugin-react | ^5 / ^4 |
| コンパイラ最適化 | React Compiler (babel-plugin-react-compiler) | ^1 |
| API コード生成 | Orval | ^8 |
| テスト | Vitest + jsdom + @testing-library/react | ^4 / ^26 / ^16 |
| 型検査 | TypeScript + typescript-eslint | ^5.6 / ^8 |
| Lint | ESLint + eslint-plugin-react-hooks | ^10 / ^7 |

---

## 3. 主な機能

- **ノードフローエディタ**: 画像処理ステップをドラッグ＆ドロップで並べ替えるビジュアルキャンバス
- **パイプライン管理**: ステップの追加・削除・並び替え・パラメータ調整。ドラフトを localStorage に自動保存
- **プリセット**: 組み込みプリセット（Standard・Edge・HDR 風 等）＋ユーザー定義プリセット
- **非同期ジョブ追跡**: ジョブ投入後に 1.5 秒間隔でポーリング、完了時に結果ページへ自動遷移
- **結果比較ビューア**: 処理前後の画像比較スライダー、ヒストグラム表示
- **AI 解析結果表示**: OCR テキスト・物体検出・背景除去マスク・AI キャプション候補を表示
- **ジョブ履歴**: 過去ジョブの一覧表示と結果の再表示

---

## 4. セットアップ手順（クイックスタート）

### Docker を使う場合（推奨）

```bash
# リポジトリルートで実行
cp frontend/.env.example frontend/.env

docker compose up --build
```

UI: `http://localhost:5173`

### ローカルで直接起動する場合

```bash
cd frontend

# 依存関係インストール
npm install

# 環境変数設定
cp .env.example .env
# VITE_API_BASE_URL を編集（バックエンドが別ポートの場合）

# 開発サーバー起動（ホットリロード）
npm run dev
```

UI: `http://localhost:5173`

---

## 5. 環境変数

`.env` ファイル（プレフィックス `VITE_`）で設定します。Vite がビルド時に埋め込みます。

| 変数名 | デフォルト値 | 説明 |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `http://localhost:8000` | バックエンド API のベース URL |

> **注意**: `VITE_` プレフィックスのない変数はクライアントバンドルに含まれません。シークレット情報は絶対に `VITE_` 変数に入れないでください。

---

## 6. API 連携

### コード生成（Orval）

バックエンドの OpenAPI 仕様（`docs/openapi.json`）から TypeScript 型と Zod スキーマを自動生成します。

```bash
npm run codegen   # orval --config orval.config.ts を実行
```

生成先:

| ファイル | 内容 |
| --- | --- |
| `src/shared/api/__generated__/api.types.ts` | TypeScript 型 + fetch ラッパー関数 |
| `src/shared/api/__generated__/api.schemas.ts` | Zod スキーマ（レスポンス検証用） |

### カスタム fetch（mutator）

`src/shared/api/mutator.ts` の `customFetch` が Orval の generated 関数に注入されます。
`VITE_API_BASE_URL` を使ってベース URL を解決し、エラーレスポンスを `ApiError` に変換します。

### 手書き API ラッパー（jobApi.ts）

`src/shared/api/jobApi.ts` は Orval generated 関数の上に薄いラッパーを追加します:

- `createProcessJob`: operations 空チェック後に `POST /api/images/jobs`
- `fetchProcessJob`: `GET /api/images/jobs/{job_id}` + Zod による型保証
- `fetchProcessJobs`: `GET /api/images/jobs` + 全件 Zod パース

手書き部分: `ProcessImageRequest`（form upload 型）・`ApiErrorBody`・`ImageProcessJob` 判別 union（Orval がエンドポイントごとにインライン展開するため）。

### API 型のエイリアス

`src/shared/types/api.ts` が生成型を短名でアプリ全体に公開します（例: `ImageOperationParameters` → `OperationParameters`）。

---

## 7. ディレクトリ構成・設計方針

Feature-Sliced Design（FSD）を採用しています。インポートは上位レイヤーから下位レイヤーへの一方向のみ許可されます。

> 詳細は公式ドキュメント [https://feature-sliced.design/](https://feature-sliced.design/) を参照してください。

```text
src/
├── app/                        # エントリーポイント・プロバイダ・ルーティング
│   ├── App.tsx                 # popstate ベースの手動ルーター
│   ├── providers/
│   └── routes.tsx              # / → StudioPage, /result → ResultPage
├── pages/
│   ├── studio/StudioPage.tsx   # メイン編集ページ（3 フックを合成）
│   └── result/ResultPage.tsx   # 処理結果表示ページ
├── widgets/                    # ページを構成する UI ブロック
│   ├── node-flow-canvas/       # ドラッグ可能なノードグラフキャンバス
│   ├── inspector-panel/        # パラメータ調整・プリセット選択・実行ボタン
│   ├── pipeline-section/       # リスト形式のパイプライン編集ビュー
│   ├── jobs-section/           # ジョブ履歴・ステータスパネル
│   ├── comparison-panel/       # 処理前後比較スライダー
│   ├── comparison-strip/       # 結果ページ上部の画像ストリップ
│   ├── analysis-panel/         # OCR / 物体検出 / キャプション結果
│   ├── studio-sidebar/         # セクション切り替えナビ
│   ├── studio-topbar/          # スタジオヘッダーバー
│   └── result-topbar/          # 結果ページヘッダーバー
├── features/                   # ユーザー向け機能
│   ├── image-upload/           # ファイル選択・プレビュー URL 管理（useImageFile）
│   ├── pipeline-edit/          # ステップ編集・プリセット管理・localStorage 永続化（usePipeline）
│   └── job-tracking/           # ジョブ投入・ポーリング・完了コールバック（useJobTracking）
├── entities/                   # ドメインオブジェクト
│   ├── image/                  # 画像比較ユーティリティ
│   ├── job/                    # processResultStore（sessionStorage 経由の結果受け渡し）
│   ├── operation/              # 操作定義・デフォルト値・制約・ラベル
│   └── pipeline/               # PipelineStepDraft・ParameterState 等の型定義
└── shared/                     # アプリ全域で再利用するコード
    ├── api/                    # customFetch mutator・jobApi・apiClient・__generated__/
    ├── config/env.ts           # VITE_API_BASE_URL の読み込み
    ├── lib/                    # ナビゲーション・エラー変換・sessionStorage ラッパー
    ├── types/api.ts            # Orval 型のアダプタ・判別 union の組み立て
    └── ui/                     # Button・ErrorBanner・ErrorBoundary 等の共通コンポーネント
```

**インポート方向**: `app → pages → widgets → features → entities → shared`

TypeScript パスエイリアス: `@app` `@pages` `@widgets` `@features` `@entities` `@shared`

### ルーティング

React Router 不使用。`window.history.pushState` / `popstate` ベースの手動実装です:

- `shared/lib/navigation.ts:navigateTo()` — パス遷移
- `App.tsx` — `popstate` を購読して `currentPath` state を更新
- `routes.tsx` — `currentPath` に応じてページコンポーネントを切り替え

---

## 8. 状態管理・データ取得

React 組み込みの `useState` / `useEffect` / `useRef` のみを使用します。外部状態管理ライブラリはありません。

### StudioPage のフック合成

`StudioPage` は独立した 3 つのフックを合成します。各フックが独自のエラーメッセージを持ちます。

| フック | 場所 | 状態ドメイン |
| --- | --- | --- |
| `useImageFile` | `features/image-upload/model/` | ファイル選択・プレビュー URL |
| `usePipeline` | `features/pipeline-edit/model/` | パイプラインステップ・プリセット・ドラフト永続化 |
| `useJobTracking` | `features/job-tracking/model/` | 非同期ジョブのライフサイクル・ポーリング・完了コールバック |

### 非同期ジョブフロー

```text
submitJob(file, ops)
  → POST /api/images/jobs → job_id 取得
  → useJobTracking が 1500 ms ごとにポーリング
  → status === 'completed' → sessionStorage に結果保存
  → onCompleted() → navigateTo('/result')
ResultPage → sessionStorage から結果を読み込む
```

ページ間のデータ受け渡しは `sessionStorage` 経由です（`entities/job/lib/processResultStore.ts`）。
`SecurityError` 対策と SSR 互換のため、Storage アクセスはすべて try/catch でラップされています。

### localStorage 永続化

パイプラインのドラフトとユーザー定義プリセットは `localStorage` に保存されます（`features/pipeline-edit/lib/pipelineStorage.ts`）。

### パラメータ単位変換

`ParameterState`（UI 側, camelCase）と `OperationParameters`（API 側, snake_case）は一部フィールドの単位が異なります。変換は `features/pipeline-edit/lib/pipeline.ts:buildOperationStep` の `parameterBuilders` のみで行います:

| フィールド | UI 単位 | API 単位 |
| --- | --- | --- |
| `detectionThreshold` | 整数パーセント [10, 95] | 小数 [0.1, 0.95] |
| `blurStrength` | 奇数カーネルサイズ | 同じ（奇数制約は UI で強制） |
| `blurSigma` | [0, 10]（0 = 自動） | 同じ |

---

## 9. ビルド・デプロイ

### ビルドコマンド

```bash
npm run build     # tsc -b && vite build → dist/
npm run preview   # dist/ をローカルプレビュー（:4173）
```

### 本番向け Docker

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY . .
CMD ["npm", "run", "dev", "--", "--host"]
```

開発用イメージで `--host` を付けてコンテナ外からアクセス可能にしています。

### 環境別の API エンドポイント切り替え

`VITE_API_BASE_URL` を環境ごとに変えるだけで接続先を切り替えられます:

| 環境 | `VITE_API_BASE_URL` |
| --- | --- |
| ローカル開発 | `http://localhost:8000` |
| Docker Compose | `http://localhost:8000`（デフォルト） |
| 本番 | バックエンドの公開 URL |

### API コード生成の CI 検証

`.github/workflows/check-generated.yml` が PR ごとに `npm run codegen` を再実行し、生成ファイル（`docs/openapi.json`・`__generated__/`）の差分がないことを確認します。

---

## 10. テスト

```bash
# 全テスト実行
npm run test

# ウォッチモード（Vitest CLI）
npx vitest

# 型検査のみ
npx tsc --noEmit
```

### テスト構成

| 対象 | テストファイル | 内容 |
| --- | --- | --- |
| `features/pipeline-edit/lib/pipeline.ts` | `pipeline.test.ts` | `buildOperationStep` の単位変換・バリデーション |
| `features/pipeline-edit/lib/pipelineStorage.ts` | `pipelineStorage.test.ts` | localStorage への読み書き |
| `features/job-tracking/model/useJobTracking.ts` | `useJobTracking.test.ts` | ポーリング・エラーハンドリング |
| `shared/api/jobApi.ts` | `jobApi.test.ts` | API ラッパーの正常系・異常系 |
| `shared/api/mutator.ts` | `mutator.test.ts` | カスタム fetch・エラー変換 |
| `widgets/analysis-panel/` | `AnalysisPanel.test.tsx` | レンダリングテスト |
| `widgets/jobs-section/` | `JobHistoryPanel.test.tsx` | ジョブ一覧表示 |

テスト環境: jsdom（ブラウザ API をシミュレート）、`@testing-library/react`（コンポーネントテスト）

---

## 11. セキュリティ

| 対策 | 実装箇所 |
| --- | --- |
| 環境変数はビルド時に埋め込み（`VITE_` プレフィックスのみ公開） | `vite.config.ts` / Vite の設計 |
| `sessionStorage` アクセスの try/catch（プライベートブラウジング対策） | `entities/job/lib/processResultStore.ts`・`shared/lib/sessionJson.ts` |
| Zod によるレスポンスバリデーション（予期しないスキーマを早期に拒絶） | `shared/api/jobApi.ts` |
| `AbortSignal.timeout(10_000)` でリクエストタイムアウトを強制 | `shared/api/jobApi.ts` |
| `ApiError` による一貫したエラーラップ（生のレスポンスがそのまま UI に漏れない） | `shared/api/apiClient.ts`・`mutator.ts` |
| React Compiler による自動メモ化（不要な再レンダリングを抑制） | `vite.config.ts`（`babel-plugin-react-compiler`） |
| `ErrorBoundary` によるコンポーネントクラッシュの局所化 | `shared/ui/ErrorBoundary.tsx`（StudioPage の各セクションに適用） |

---

## 12. 主要パッケージとその選定理由

| パッケージ | 選定理由 |
| --- | --- |
| **React 18** | Concurrent Features と React Compiler による自動最適化。hooks ベースの状態管理で外部ライブラリ不要 |
| **Vite** | esbuild ベースの高速 HMR。TypeScript / パスエイリアスのネイティブサポート |
| **Tailwind CSS** | クラス名だけでスタイルが完結し、テーマ変数（CSS カスタムプロパティ）と組み合わせてダークテーマを実現 |
| **Orval** | OpenAPI 仕様から TypeScript 型と Zod スキーマを自動生成。バックエンドとの型ズレを CI で検知できる |
| **Zod v4** | ランタイムでのレスポンス検証。スキーマ違反を即座に `ApiError` に変換してデバッグを容易にする |
| **@dnd-kit** | ヘッドレスなドラッグ＆ドロップ。アクセシビリティ対応と React との統合が良好 |
| **Vitest** | Vite と設定を共有できるためパスエイリアスの二重設定が不要。jsdom で DOM テストを高速実行 |
| **@testing-library/react** | 実装詳細ではなくユーザー操作視点のテストを書くための標準ライブラリ |
| **react-compiler-runtime** | React Compiler のランタイム依存。コンパイラが `useMemo` / `useCallback` を自動挿入する際に使用 |
