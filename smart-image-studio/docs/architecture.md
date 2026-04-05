# Smart Image Studio アーキテクチャ概要

## 方針

- frontend と backend を同一リポジトリで管理するモノレポ構成
- UI と API 通信を分離し、機能追加時の影響範囲を小さく保つ
- 画像処理ロジックを FastAPI のサービス層に切り出し、AI 機能の追加先を明確にする

## frontend

- `src/api/apiClient.ts`
  - `baseURL` 管理
  - リクエスト共通化
  - JSON / FormData の扱い
  - レスポンス / エラーハンドリング共通化
- `src/api/imageApi.ts`
  - 画像処理 API のユースケース単位の関数
- `src/api/pipelineApi.ts`
  - 自然文解釈 API と `process-pipeline` API のユースケース関数
- `src/hooks/useImageStudio.ts`
  - UI 状態とイベント処理の集約
  - 単体処理の polling と履歴同期
  - backend の `PipelinePlan` を UI に反映
- `src/components/*`
  - 表示責務のみ
  - 結果ページでは AI 可視化 overlay を表示

## backend

- `app/api/routes/images.py`
  - multipart/form-data の受け口
  - 単一処理と `operations` JSON の両対応
  - 同期処理と非同期ジョブ処理の両対応
- `app/api/routes/pipeline.py`
  - `POST /api/pipeline/interpret`
  - interpreter の選択と応答整形
- `app/services/image_processor.py`
  - 処理ごとの関数を集約
  - 複数ステップ処理に拡張しやすい構造
  - 解析結果から caption 候補を組み立てる
- `app/services/pipeline_interpreter.py`
  - `PipelineInterpreter` interface
- `app/services/rule_based_interpreter.py`
  - fallback 用のルールベース解釈
- `app/services/llm_interpreter.py`
  - LLM を使った自然文 -> `PipelinePlan` 変換
- `app/services/pipeline_interpreter_factory.py`
  - settings に応じた interpreter 切替
- `app/services/job_service.py`
  - job id 発行
  - キュー管理
  - 進捗更新
  - 履歴保存
- `app/services/ocr_service.py`
  - OCR 推論とアノテーション描画
- `app/services/object_detection_service.py`
  - MobileNet SSD による物体検出と枠描画
- `app/services/storage_service.py`
  - ローカル保存を責務分離
- `app/utils/image_validation.py`
  - 非画像ファイルやサイズ超過の検証

## 追加済み機能

- `background_removal`
  - GrabCut ベースで背景を透過
- `ocr`
  - OCR 結果をテキストと座標付きで返却
- `object_detection`
  - MobileNet SSD で検出し、描画済み画像と検出一覧を返却

## 今後の拡張ポイント

- `OperationType` を増やす
- `ImageProcessor` の handler を追加する
- frontend の `operationOptions` に UI 定義を追加する
- `operations` 配列を UI 上で複数選択可能にする
- `LLMInterpreter` を別 provider に差し替える
- 保存先をローカルから S3 などへ差し替える
- polling を SSE / WebSocket に差し替える
- ジョブ履歴を DB 永続化に切り替える
