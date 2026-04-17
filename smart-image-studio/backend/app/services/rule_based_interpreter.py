from app.schemas.image import (
    ImageOperationParameters,
    ImageOperationStep,
    OperationType,
)
from app.schemas.pipeline import (
    PipelineInterpreterMode,
    PipelinePlan,
    PipelinePlanConfidence,
)
from app.services.pipeline_interpreter import PipelineInterpreter


def _includes_any(input_text: str, keywords: list[str]) -> bool:
    return any(keyword in input_text for keyword in keywords)


class RuleBasedInterpreter(PipelineInterpreter):
    def interpret(self, instruction: str) -> PipelinePlan:
        normalized = instruction.strip().lower()
        notes: list[str] = []
        matched_goals: list[str] = []
        steps: list[ImageOperationStep] = []

        mentions_background = _includes_any(normalized, ["背景", "切り抜", "透過", "削除", "残して"])
        mentions_person = _includes_any(normalized, ["人物", "人", "顔", "ポートレート"])
        mentions_product = _includes_any(normalized, ["商品", "物撮り", "ec", "物だけ"])
        mentions_noise = _includes_any(normalized, ["ノイズ", "ざらつき", "荒れ", "滑らか"])
        mentions_blur = _includes_any(normalized, ["ぼかし", "ぼかして", "blur"])
        mentions_sharpen = _includes_any(normalized, ["くっきり", "シャープ", "輪郭", "目立", "強調"])
        mentions_brightness = _includes_any(normalized, ["明る", "見やす", "映える"])
        mentions_contrast = _includes_any(normalized, ["コントラスト", "メリハリ", "はっきり"])
        mentions_detection = _includes_any(normalized, ["検出", "何が写", "物体"])
        mentions_caption = _includes_any(normalized, ["説明", "キャプション", "要約"])
        mentions_white_background = _includes_any(normalized, ["白背景", "白い背景"])

        if mentions_background or mentions_product:
            steps.append(ImageOperationStep(operation=OperationType.BACKGROUND_REMOVAL))
            matched_goals.append("背景除去を追加")

        if mentions_noise:
            steps.append(
                ImageOperationStep(
                    operation=OperationType.DENOISE,
                    parameters=ImageOperationParameters(denoise_strength=8),
                )
            )
            matched_goals.append("ノイズ低減を追加")

        if mentions_blur and not mentions_noise:
            steps.append(
                ImageOperationStep(
                    operation=OperationType.BLUR,
                    parameters=ImageOperationParameters(blur_strength=7),
                )
            )
            matched_goals.append("ぼかしを追加")

        if mentions_brightness or mentions_person or mentions_product:
            steps.append(
                ImageOperationStep(
                    operation=OperationType.BRIGHTNESS,
                    parameters=ImageOperationParameters(brightness=18 if mentions_person else 12 if mentions_product else 20),
                )
            )
            matched_goals.append("明るさ補正を追加")

        if mentions_contrast:
            steps.append(
                ImageOperationStep(
                    operation=OperationType.CONTRAST,
                    parameters=ImageOperationParameters(contrast=18),
                )
            )
            matched_goals.append("コントラスト補正を追加")

        if mentions_sharpen or mentions_person or mentions_product:
            steps.append(
                ImageOperationStep(
                    operation=OperationType.SHARPEN,
                    parameters=ImageOperationParameters(sharpen_strength=2),
                )
            )
            matched_goals.append("シャープ化を追加")

        if mentions_detection:
            steps.append(
                ImageOperationStep(
                    operation=OperationType.OBJECT_DETECTION,
                    parameters=ImageOperationParameters(detection_threshold=0.45),
                )
            )
            matched_goals.append("物体検出を追加")

        if mentions_caption:
            steps.append(ImageOperationStep(operation=OperationType.CAPTION_GENERATION))
            matched_goals.append("キャプション生成を追加")

        if mentions_white_background:
            notes.append("白背景への塗りつぶしは未対応です。現状は透過背景までを実行します。")

        unique_steps: list[ImageOperationStep] = []
        seen_operations: set[OperationType] = set()
        for step in steps:
            if step.operation in seen_operations:
                continue
            seen_operations.add(step.operation)
            unique_steps.append(step)

        confidence = PipelinePlanConfidence.LOW
        if len(matched_goals) >= 3:
            confidence = PipelinePlanConfidence.HIGH
        elif len(matched_goals) >= 1:
            confidence = PipelinePlanConfidence.MEDIUM

        if not unique_steps:
            notes.append("現在のルールでは明確な処理に変換できませんでした。背景除去、ノイズ低減、商品画像整形などで試してください。")

        summary = (
            f"{len(unique_steps)} ステップのパイプライン候補を作成しました。" if unique_steps else "処理フローを特定できませんでした。"
        )

        return PipelinePlan(
            source_instruction=instruction.strip(),
            interpreter=PipelineInterpreterMode.RULE_BASED,
            summary=summary,
            confidence=confidence,
            notes=notes,
            steps=unique_steps,
        )
