import logging
from collections.abc import Callable
from dataclasses import dataclass, field
from io import BytesIO
from typing import TYPE_CHECKING, assert_never

from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.exceptions import ImageProcessingError
from app.infrastructure.image_processing import opencv_processor as cv_ops
from app.schemas.image import (
    CaptionCandidate,
    CaptionResult,
    ImageAnalysisResult,
    ImageOperationStep,
    OperationType,
)

if TYPE_CHECKING:
    from app.services.caption_service import CaptionService
    from app.services.object_detection_service import ObjectDetectionService
    from app.services.ocr_service import OcrService

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ImageProcessingResult:
    image: Image.Image
    analysis: ImageAnalysisResult | None = None
    background_mask: Image.Image | None = None
    overlays: dict[str, Image.Image] = field(default_factory=dict)


class ImageProcessor:
    def __init__(
        self,
        ocr_service_factory: "Callable[[], OcrService]",
        object_detection_service_factory: "Callable[[], ObjectDetectionService]",
        caption_service_factory: "Callable[[], CaptionService]",
    ) -> None:
        self._ocr_factory = ocr_service_factory
        self._detection_factory = object_detection_service_factory
        self._caption_factory = caption_service_factory

    def process(
        self,
        image_bytes: bytes,
        operations: list[ImageOperationStep],
        progress_callback: Callable[[int, str], None] | None = None,
    ) -> ImageProcessingResult:
        if not operations:
            raise ImageProcessingError("少なくとも 1 つの処理を指定してください。")

        try:
            image = ImageOps.exif_transpose(Image.open(BytesIO(image_bytes)))
        except (UnidentifiedImageError, OSError) as exc:
            raise ImageProcessingError("画像の読み込みに失敗しました。") from exc

        if progress_callback is not None:
            progress_callback(18, "画像を読み込んでいます。")

        analysis_result: ImageAnalysisResult | None = None
        total_steps = len(operations)
        background_mask: Image.Image | None = None
        overlays: dict[str, Image.Image] = {}

        for index, step in enumerate(operations):
            if progress_callback is not None:
                progress_callback(20 + int((index / total_steps) * 60), f"{step.operation.value} を実行しています。")

            result = self._dispatch(image, step)
            image = result.image
            analysis_result = self._merge_analysis(analysis_result, result.analysis)
            if result.background_mask is not None:
                background_mask = result.background_mask
            overlays.update(result.overlays)

            if progress_callback is not None:
                progress_callback(20 + int(((index + 1) / total_steps) * 60), f"{step.operation.value} が完了しました。")

        if analysis_result is not None:
            analysis_result = self._append_caption_candidates(analysis_result)
        return ImageProcessingResult(
            image=image,
            analysis=analysis_result if analysis_result is not None and self._has_analysis(analysis_result) else None,
            background_mask=background_mask,
            overlays=overlays,
        )

    def _dispatch(self, image: Image.Image, step: ImageOperationStep) -> "ImageProcessingResult":
        p = step.parameters
        match step.operation:
            case OperationType.GRAYSCALE:
                return ImageProcessingResult(image=cv_ops.apply_grayscale(image))
            case OperationType.BLUR:
                return ImageProcessingResult(image=cv_ops.apply_blur(image, p))
            case OperationType.SHARPEN:
                return ImageProcessingResult(image=cv_ops.apply_sharpen(image, p))
            case OperationType.DENOISE:
                return ImageProcessingResult(image=cv_ops.apply_denoise(image, p))
            case OperationType.EDGE_DETECTION:
                return ImageProcessingResult(image=cv_ops.apply_edge_detection(image))
            case OperationType.BRIGHTNESS:
                return ImageProcessingResult(image=cv_ops.apply_brightness(image, p))
            case OperationType.CONTRAST:
                return ImageProcessingResult(image=cv_ops.apply_contrast(image, p))
            case OperationType.BACKGROUND_REMOVAL:
                result_image, analysis, mask = cv_ops.apply_background_removal(image)
                return ImageProcessingResult(image=result_image, analysis=analysis, background_mask=mask)
            case OperationType.OCR:
                ocr_exec = self._ocr_factory().recognize(image)
                return ImageProcessingResult(
                    image=image,
                    analysis=ImageAnalysisResult(ocr=ocr_exec.result),
                    overlays={"ocr_overlay": ocr_exec.overlay},
                )
            case OperationType.OBJECT_DETECTION:
                threshold = p.detection_threshold or 0.45
                det_exec = self._detection_factory().detect(image, threshold)
                return ImageProcessingResult(
                    image=image,
                    analysis=ImageAnalysisResult(object_detection=det_exec.result),
                    overlays={"object_detection_overlay": det_exec.overlay},
                )
            case OperationType.CAPTION_GENERATION:
                try:
                    captions = self._caption_factory().generate(image)
                except ImageProcessingError as exc:
                    logger.warning("LM Studio unavailable, skipping LLM caption: %s", exc, exc_info=True)
                    captions = CaptionResult(candidates=[], error_message=str(exc))
                return ImageProcessingResult(image=image, analysis=ImageAnalysisResult(captions=captions))
            case _:
                assert_never(step.operation)

    @staticmethod
    def _merge_analysis(current: ImageAnalysisResult | None, incoming: ImageAnalysisResult | None) -> ImageAnalysisResult | None:
        if incoming is None:
            return current
        if current is None:
            return incoming
        return ImageAnalysisResult(
            background_removal=incoming.background_removal if incoming.background_removal is not None else current.background_removal,
            ocr=incoming.ocr if incoming.ocr is not None else current.ocr,
            object_detection=incoming.object_detection if incoming.object_detection is not None else current.object_detection,
            captions=incoming.captions if incoming.captions is not None else current.captions,
        )

    @staticmethod
    def _has_analysis(result: ImageAnalysisResult) -> bool:
        return any(
            (
                result.background_removal is not None,
                result.ocr is not None,
                result.object_detection is not None,
                result.captions is not None,
            )
        )

    @staticmethod
    def _append_caption_candidates(result: ImageAnalysisResult) -> ImageAnalysisResult:
        candidates: list[CaptionCandidate] = []
        existing_texts: set[str] = set()

        if result.captions is not None:
            for c in result.captions.candidates:
                candidates.append(c)
                existing_texts.add(c.text)

        detection_labels: list[str] = []
        if result.object_detection is not None:
            for item in sorted(result.object_detection.detections, key=lambda d: d.confidence, reverse=True):
                if item.label not in detection_labels:
                    detection_labels.append(item.label)
                if len(detection_labels) >= 3:
                    break

        ocr_text = ""
        if result.ocr is not None and result.ocr.full_text.strip():
            ocr_text = result.ocr.full_text.strip().replace("\n", " ")

        def _add(text: str, score: float) -> None:
            if text not in existing_texts:
                candidates.append(CaptionCandidate(text=text, score=score))
                existing_texts.add(text)

        if detection_labels:
            _add(f"{'、'.join(detection_labels)} を中心に捉えた画像", 0.84)
        if ocr_text:
            _add(f"「{ocr_text[:32]}」を含む画像", 0.77)
        if detection_labels and ocr_text:
            _add(f"{'、'.join(detection_labels)} と「{ocr_text[:20]}」が写る画像", 0.71)
        if result.background_removal is not None:
            subject = "、".join(detection_labels) if detection_labels else "被写体"
            _add(f"{subject} を切り抜いた画像", 0.68)

        if candidates:
            existing_error = result.captions.error_message if result.captions is not None else None
            result.captions = CaptionResult(candidates=candidates[:4], error_message=existing_error)
        return result
