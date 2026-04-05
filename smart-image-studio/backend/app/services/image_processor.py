from collections.abc import Callable
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from typing import TYPE_CHECKING

import cv2
import numpy as np
from PIL import Image, ImageEnhance, ImageOps, UnidentifiedImageError

from app.schemas.image import (
    BackgroundRemovalResult,
    CaptionCandidate,
    CaptionResult,
    ImageAnalysisResult,
    ImageOperationParameters,
    ImageOperationStep,
    OperationType,
)
from app.services.object_detection_service import ObjectDetectionService

if TYPE_CHECKING:
    from app.services.ocr_service import OcrService


class ImageProcessingError(Exception):
    pass


@dataclass(frozen=True)
class ImageProcessingResult:
    image: Image.Image
    analysis: ImageAnalysisResult | None = None
    background_mask: Image.Image | None = None


@dataclass(frozen=True)
class OperationApplicationResult:
    image: Image.Image
    analysis: ImageAnalysisResult | None = None
    background_mask: Image.Image | None = None


class ImageProcessor:
    def __init__(self) -> None:
        self._models_dir = Path(__file__).resolve().parents[1] / "models"
        self._ocr_service: OcrService | None = None
        self._object_detection_service: ObjectDetectionService | None = None
        self._handlers: dict[
            OperationType,
            Callable[
                [Image.Image, ImageOperationParameters],
                OperationApplicationResult,
            ],
        ] = {
            OperationType.GRAYSCALE: self._apply_grayscale,
            OperationType.BLUR: self._apply_blur,
            OperationType.SHARPEN: self._apply_sharpen,
            OperationType.DENOISE: self._apply_denoise,
            OperationType.EDGE_DETECTION: self._apply_edge_detection,
            OperationType.BRIGHTNESS: self._apply_brightness,
            OperationType.CONTRAST: self._apply_contrast,
            OperationType.BACKGROUND_REMOVAL: self._apply_background_removal,
            OperationType.OCR: self._apply_ocr,
            OperationType.OBJECT_DETECTION: self._apply_object_detection,
            OperationType.CAPTION_GENERATION: self._apply_caption_generation,
        }

    def process(
        self,
        image_bytes: bytes,
        operations: list[ImageOperationStep],
        progress_callback: Callable[[int, str], None] | None = None,
    ) -> ImageProcessingResult:
        if not operations:
            raise ImageProcessingError("少なくとも 1 つの処理を指定してください。")

        try:
            image = Image.open(BytesIO(image_bytes)).convert("RGB")
        except (UnidentifiedImageError, OSError) as exc:
            raise ImageProcessingError("画像の読み込みに失敗しました。") from exc

        if progress_callback is not None:
            progress_callback(18, "画像を読み込んでいます。")

        analysis_result = ImageAnalysisResult()
        total_steps = len(operations)
        background_mask: Image.Image | None = None

        for index, step in enumerate(operations):
            handler = self._handlers.get(step.operation)
            if handler is None:
                raise ImageProcessingError(f"未対応の処理です: {step.operation}")

            if progress_callback is not None:
                progress_callback(
                    20 + int((index / total_steps) * 60),
                    f"{step.operation.value} を実行しています。",
                )

            operation_result = handler(image, step.parameters)
            image = operation_result.image
            analysis_result = self._merge_analysis(analysis_result, operation_result.analysis)
            if operation_result.background_mask is not None:
                background_mask = operation_result.background_mask

            if progress_callback is not None:
                progress_callback(
                    20 + int(((index + 1) / total_steps) * 60),
                    f"{step.operation.value} が完了しました。",
                )

        analysis_result = self._append_caption_candidates(analysis_result)

        return ImageProcessingResult(
            image=image,
            analysis=analysis_result if self._has_analysis(analysis_result) else None,
            background_mask=background_mask,
        )

    def _apply_grayscale(
        self, image: Image.Image, _: ImageOperationParameters
    ) -> OperationApplicationResult:
        return OperationApplicationResult(image=ImageOps.grayscale(image).convert("RGB"))

    def _apply_blur(
        self, image: Image.Image, parameters: ImageOperationParameters
    ) -> OperationApplicationResult:
        strength = parameters.blur_strength or 5
        kernel_size = self._normalize_kernel_size(strength)
        cv_image = self._pil_to_cv(image)
        blurred = cv2.GaussianBlur(cv_image, (kernel_size, kernel_size), sigmaX=0)
        return OperationApplicationResult(image=self._cv_to_pil(blurred))

    def _apply_sharpen(
        self, image: Image.Image, parameters: ImageOperationParameters
    ) -> OperationApplicationResult:
        strength = max(1, min(parameters.sharpen_strength or 1, 5))
        cv_image = self._pil_to_cv(image)
        kernel = np.array(
            [[0, -1, 0], [-1, 5.0 + (strength - 1) * 0.8, -1], [0, -1, 0]],
            dtype=np.float32,
        )
        sharpened = cv2.filter2D(cv_image, -1, kernel)
        return OperationApplicationResult(image=self._cv_to_pil(sharpened))

    def _apply_denoise(
        self, image: Image.Image, parameters: ImageOperationParameters
    ) -> OperationApplicationResult:
        strength = max(1, min(parameters.denoise_strength or 8, 30))
        cv_image = self._pil_to_cv(image)
        denoised = cv2.fastNlMeansDenoisingColored(
            cv_image,
            None,
            h=float(strength),
            hColor=float(strength),
            templateWindowSize=7,
            searchWindowSize=21,
        )
        return OperationApplicationResult(image=self._cv_to_pil(denoised))

    def _apply_edge_detection(
        self, image: Image.Image, _: ImageOperationParameters
    ) -> OperationApplicationResult:
        cv_image = self._pil_to_cv(image)
        grayscale = cv2.cvtColor(cv_image, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(grayscale, threshold1=100, threshold2=200)
        return OperationApplicationResult(image=Image.fromarray(edges).convert("RGB"))

    def _apply_brightness(
        self, image: Image.Image, parameters: ImageOperationParameters
    ) -> OperationApplicationResult:
        brightness = parameters.brightness or 0
        factor = max(0.0, 1 + brightness / 100)
        return OperationApplicationResult(image=ImageEnhance.Brightness(image).enhance(factor))

    def _apply_contrast(
        self, image: Image.Image, parameters: ImageOperationParameters
    ) -> OperationApplicationResult:
        contrast = parameters.contrast or 0
        factor = max(0.0, 1 + contrast / 100)
        return OperationApplicationResult(image=ImageEnhance.Contrast(image).enhance(factor))

    def _apply_background_removal(
        self, image: Image.Image, _: ImageOperationParameters
    ) -> OperationApplicationResult:
        image_rgb = image.convert("RGB")
        cv_image = self._pil_to_cv(image_rgb)
        height, width = cv_image.shape[:2]
        margin = max(1, int(min(width, height) * 0.05))
        rect_width = max(1, width - margin * 2)
        rect_height = max(1, height - margin * 2)
        rectangle = (margin, margin, rect_width, rect_height)
        mask = np.zeros((height, width), np.uint8)
        background_model = np.zeros((1, 65), np.float64)
        foreground_model = np.zeros((1, 65), np.float64)

        try:
            cv2.grabCut(
                cv_image,
                mask,
                rectangle,
                background_model,
                foreground_model,
                5,
                cv2.GC_INIT_WITH_RECT,
            )
        except cv2.error as exc:
            raise ImageProcessingError("背景除去に失敗しました。") from exc

        alpha_mask = np.where(
            (mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD),
            255,
            0,
        ).astype("uint8")
        cleaned_mask = cv2.morphologyEx(
            alpha_mask,
            cv2.MORPH_OPEN,
            np.ones((3, 3), np.uint8),
        )
        rgba_image = image_rgb.convert("RGBA")
        rgba_image.putalpha(Image.fromarray(cleaned_mask))
        foreground_ratio = float(np.count_nonzero(cleaned_mask)) / float(cleaned_mask.size)
        return OperationApplicationResult(
            image=rgba_image,
            analysis=ImageAnalysisResult(
                background_removal=BackgroundRemovalResult(
                    foreground_ratio=foreground_ratio
                )
            ),
            background_mask=Image.fromarray(cleaned_mask).convert("L"),
        )

    def _apply_ocr(
        self, image: Image.Image, _: ImageOperationParameters
    ) -> OperationApplicationResult:
        try:
            execution_result = self._get_ocr_service().recognize(image)
        except Exception as exc:
            raise ImageProcessingError("OCR の実行に失敗しました。") from exc
        return OperationApplicationResult(
            image=execution_result.image,
            analysis=ImageAnalysisResult(ocr=execution_result.result),
        )

    def _apply_object_detection(
        self, image: Image.Image, parameters: ImageOperationParameters
    ) -> OperationApplicationResult:
        threshold = parameters.detection_threshold or 0.45
        try:
            execution_result = self._get_object_detection_service().detect(image, threshold)
        except Exception as exc:
            raise ImageProcessingError("物体検出の実行に失敗しました。") from exc
        return OperationApplicationResult(
            image=execution_result.image,
            analysis=ImageAnalysisResult(object_detection=execution_result.result),
        )

    def _apply_caption_generation(
        self, image: Image.Image, _: ImageOperationParameters
    ) -> OperationApplicationResult:
        return OperationApplicationResult(
            image=image,
            analysis=ImageAnalysisResult(
                captions=CaptionResult(candidates=self._build_visual_caption_candidates(image))
            ),
        )

    @staticmethod
    def _normalize_kernel_size(value: int) -> int:
        normalized = max(1, min(value, 25))
        if normalized % 2 == 0:
            normalized += 1
        return normalized

    @staticmethod
    def _pil_to_cv(image: Image.Image) -> np.ndarray:
        rgb = np.array(image.convert("RGB"))
        return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)

    @staticmethod
    def _cv_to_pil(image: np.ndarray) -> Image.Image:
        rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        return Image.fromarray(rgb)

    @staticmethod
    def _merge_analysis(
        current: ImageAnalysisResult,
        incoming: ImageAnalysisResult | None,
    ) -> ImageAnalysisResult:
        if incoming is None:
            return current

        if incoming.background_removal is not None:
            current.background_removal = incoming.background_removal
        if incoming.ocr is not None:
            current.ocr = incoming.ocr
        if incoming.object_detection is not None:
            current.object_detection = incoming.object_detection
        if incoming.captions is not None:
            current.captions = incoming.captions
        return current

    @staticmethod
    def _has_analysis(result: ImageAnalysisResult) -> bool:
        return any(
            (
                result.background_removal is not None,
                result.ocr is not None,
                result.object_detection is not None,
                result.captions is not None and len(result.captions.candidates) > 0,
            )
        )

    @staticmethod
    def _append_caption_candidates(result: ImageAnalysisResult) -> ImageAnalysisResult:
        candidates: list[CaptionCandidate] = []
        existing_texts: set[str] = set()

        if result.captions is not None:
            for candidate in result.captions.candidates:
                candidates.append(candidate)
                existing_texts.add(candidate.text)

        detection_labels: list[str] = []
        if result.object_detection is not None:
            for item in sorted(
                result.object_detection.detections,
                key=lambda detection: detection.confidence,
                reverse=True,
            ):
                if item.label not in detection_labels:
                    detection_labels.append(item.label)
                if len(detection_labels) >= 3:
                    break

        ocr_text = ""
        if result.ocr is not None and result.ocr.full_text.strip() != "":
            ocr_text = result.ocr.full_text.strip().replace("\n", " ")

        if detection_labels:
            candidate = CaptionCandidate(
                text=f"{'、'.join(detection_labels)} を中心に捉えた画像",
                score=0.84,
            )
            if candidate.text not in existing_texts:
                candidates.append(candidate)
                existing_texts.add(candidate.text)

        if ocr_text:
            text_preview = ocr_text[:32]
            candidate = CaptionCandidate(
                text=f"「{text_preview}」を含む画像",
                score=0.77,
            )
            if candidate.text not in existing_texts:
                candidates.append(candidate)
                existing_texts.add(candidate.text)

        if detection_labels and ocr_text:
            text_preview = ocr_text[:20]
            candidate = CaptionCandidate(
                text=f"{'、'.join(detection_labels)} と「{text_preview}」が写る画像",
                score=0.71,
            )
            if candidate.text not in existing_texts:
                candidates.append(candidate)
                existing_texts.add(candidate.text)

        if result.background_removal is not None:
            subject = "被写体"
            if detection_labels:
                subject = "、".join(detection_labels)
            candidate = CaptionCandidate(
                text=f"{subject} を切り抜いた画像",
                score=0.68,
            )
            if candidate.text not in existing_texts:
                candidates.append(candidate)
                existing_texts.add(candidate.text)

        if candidates:
            result.captions = CaptionResult(candidates=candidates[:4])

        return result

    @staticmethod
    def _build_visual_caption_candidates(image: Image.Image) -> list[CaptionCandidate]:
        rgb_image = image.convert("RGB")
        image_array = np.array(rgb_image)
        luminance = float(np.mean(image_array))
        width, height = rgb_image.size
        orientation = "横長" if width > height else "縦長" if height > width else "正方形"
        brightness_label = (
            "明るい" if luminance >= 180 else "落ち着いた" if luminance >= 100 else "暗めの"
        )

        candidates = [
            CaptionCandidate(
                text=f"{orientation}の構図で、{brightness_label}印象の画像",
                score=0.72,
            ),
            CaptionCandidate(
                text=f"{brightness_label}トーンで整理されたビジュアル",
                score=0.64,
            ),
        ]
        return candidates

    def _get_object_detection_service(self) -> ObjectDetectionService:
        if self._object_detection_service is None:
            try:
                self._object_detection_service = ObjectDetectionService(self._models_dir)
            except FileNotFoundError as exc:
                raise ImageProcessingError(
                    "object detection モデルが見つかりません。backend/app/models を確認してください。"
                ) from exc

        return self._object_detection_service

    def _get_ocr_service(self) -> "OcrService":
        if self._ocr_service is None:
            try:
                from app.services.ocr_service import OcrService
            except ModuleNotFoundError as exc:
                raise ImageProcessingError(
                    "OCR の依存関係が見つかりません。`pip install -r requirements.txt` を再実行してください。"
                ) from exc

            try:
                self._ocr_service = OcrService()
            except Exception as exc:
                raise ImageProcessingError("OCR エンジンの初期化に失敗しました。") from exc

        return self._ocr_service
