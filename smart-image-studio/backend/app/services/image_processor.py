import logging
from collections.abc import Callable
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from typing import TYPE_CHECKING

import cv2  # type: ignore
import numpy as np  # type: ignore
from PIL import Image, ImageEnhance, UnidentifiedImageError

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

logger = logging.getLogger(__name__)


class ImageProcessingError(Exception):
    pass


@dataclass(frozen=True)
class ImageProcessingResult:
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
                ImageProcessingResult,
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
        """バイト列の画像に対して、指定された操作を順番に適用して返す。"""
        if not operations:
            raise ImageProcessingError("少なくとも 1 つの処理を指定してください。")

        # バイト列を PIL Image に変換（RGB に統一）
        try:
            image = Image.open(BytesIO(image_bytes)).convert("RGB")
        except (UnidentifiedImageError, OSError) as exc:
            raise ImageProcessingError("画像の読み込みに失敗しました。") from exc

        if progress_callback is not None:
            progress_callback(18, "画像を読み込んでいます。")

        analysis_result = ImageAnalysisResult()
        total_steps = len(operations)
        background_mask: Image.Image | None = None

        # 各ステップのハンドラを順に呼び出し、結果を次のステップへ引き継ぐ
        for index, step in enumerate(operations):
            handler = self._handlers.get(step.operation)
            if handler is None:
                raise ImageProcessingError(f"未対応の処理です: {step.operation}")

            if progress_callback is not None:
                # 進捗を 20〜80% の範囲でステップ数に応じて報告
                progress_callback(
                    20 + int((index / total_steps) * 60),
                    f"{step.operation.value} を実行しています。",
                )

            operation_result = handler(image, step.parameters)
            image = operation_result.image
            # 各ステップの解析結果をマージして累積する
            analysis_result = self._merge_analysis(analysis_result, operation_result.analysis)
            if operation_result.background_mask is not None:
                background_mask = operation_result.background_mask

            if progress_callback is not None:
                progress_callback(
                    20 + int(((index + 1) / total_steps) * 60),
                    f"{step.operation.value} が完了しました。",
                )

        # OCR・物体検出結果を元にキャプション候補を補完する
        analysis_result = self._append_caption_candidates(analysis_result)

        return ImageProcessingResult(
            image=image,
            analysis=analysis_result if self._has_analysis(analysis_result) else None,
            background_mask=background_mask,
        )

    # グレースケール変換（ガンマ補正対応）
    def _apply_grayscale(self, image: Image.Image, _: ImageOperationParameters) -> ImageProcessingResult:
        # ガンマ2.2でリニア空間に変換 → グレースケール化 → ガンマ再エンコードの順で処理する
        # これにより知覚的に正確な輝度のグレースケール画像が得られる
        cv_image = self._pil_to_cv(image)
        img_bgr_linear = np.power(cv_image.astype("float32") / 255.0, 2.2)
        img_gray_linear = cv2.cvtColor(img_bgr_linear.astype("float32"), cv2.COLOR_BGR2GRAY)
        img_gray = (np.power(img_gray_linear, 1.0 / 2.2) * 255).astype("uint8")
        return ImageProcessingResult(image=Image.fromarray(img_gray).convert("RGB"))

    # ぼかし（ガウシアンブラー）
    def _apply_blur(self, image: Image.Image, parameters: ImageOperationParameters) -> ImageProcessingResult:
        # blur_strength をカーネルサイズに変換し、ガウシアンブラーを適用する
        # blur_sigma が 0 または未指定の場合はカーネルサイズから自動計算する
        strength = parameters.blur_strength or 5
        kernel_size = self._normalize_kernel_size(strength)
        sigma = float(parameters.blur_sigma) if parameters.blur_sigma is not None else 0.0
        cv_image = self._pil_to_cv(image)
        blurred = cv2.GaussianBlur(cv_image, (kernel_size, kernel_size), sigmaX=sigma)
        return ImageProcessingResult(image=self._cv_to_pil(blurred))

    # シャープ化（LoG ベースのラプラシアンシャープ化）
    def _apply_sharpen(self, image: Image.Image, parameters: ImageOperationParameters) -> ImageProcessingResult:
        strength = max(1, min(parameters.sharpen_strength or 1, 5))
        cv_image = self._pil_to_cv(image)
        try:
            # 色ずれ防止：Lab 色空間の L チャンネルのみにシャープ化を適用する
            lab = cv2.cvtColor(cv_image, cv2.COLOR_BGR2LAB)
            l_f = lab[:, :, 0].astype(np.float32)

            # LoG（Laplacian of Gaussian）: ガウスぼかしで JPEG ノイズ等の高周波雑音を
            # 除去してからラプラシアンを計算する。sigma=0.8 は細かいノイズを潰しつつ
            # 輪郭の情報を残すバランス点。
            smoothed = cv2.GaussianBlur(l_f, (0, 0), sigmaX=0.8)
            lap = cv2.Laplacian(smoothed, cv2.CV_32F, ksize=1)

            # ハロー抑制：局所コントラスト（dilate − erode）に比例した上限で
            # ラプラシアンをクリップし、輪郭周辺の過剰オーバーシュートを防ぐ
            _kernel_3x3 = np.ones((3, 3), dtype=np.uint8)
            local_contrast = cv2.dilate(l_f, _kernel_3x3) - cv2.erode(l_f, _kernel_3x3)
            halo_limit = np.maximum(local_contrast * 0.3, 2.0)
            lap = np.clip(lap, -halo_limit, halo_limit)

            # ラプラシアンの和は 0 なので均一な領域の明るさは変化しない。
            # strength に線形比例するシャープ化量で加算する（strength=1: 0.35, strength=5: 1.75）
            sharpened = l_f - (strength * 0.35) * lap

            # 白飛び・黒つぶれ防止
            lab[:, :, 0] = np.clip(sharpened, 0, 255).astype(np.uint8)
            result = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
        except (cv2.error, ValueError) as exc:
            raise ImageProcessingError("シャープ化に失敗しました。") from exc
        return ImageProcessingResult(image=self._cv_to_pil(result))

    # ノイズ除去（Non-Local Means アルゴリズム）
    def _apply_denoise(self, image: Image.Image, parameters: ImageOperationParameters) -> ImageProcessingResult:
        # Non-Local Means アルゴリズムでカラー画像のノイズを除去する
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
        return ImageProcessingResult(image=self._cv_to_pil(denoised))

    # エッジ検出（Canny アルゴリズム）
    def _apply_edge_detection(self, image: Image.Image, _: ImageOperationParameters) -> ImageProcessingResult:
        # グレースケール化してから Canny アルゴリズムでエッジを検出する
        cv_image = self._pil_to_cv(image)
        grayscale = cv2.cvtColor(cv_image, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(grayscale, threshold1=100, threshold2=200)
        return ImageProcessingResult(image=Image.fromarray(edges).convert("RGB"))

    # 明るさ調整
    def _apply_brightness(self, image: Image.Image, parameters: ImageOperationParameters) -> ImageProcessingResult:
        # brightness を -100〜+100 のオフセットとして受け取り、乗算係数に変換して適用する
        brightness = parameters.brightness or 0
        factor = max(0.0, 1 + brightness / 100)
        return ImageProcessingResult(image=ImageEnhance.Brightness(image).enhance(factor))

    # コントラスト調整
    def _apply_contrast(self, image: Image.Image, parameters: ImageOperationParameters) -> ImageProcessingResult:
        # contrast を -100〜+100 のオフセットとして受け取り、乗算係数に変換して適用する
        contrast = parameters.contrast or 0
        factor = max(0.0, 1 + contrast / 100)
        return ImageProcessingResult(image=ImageEnhance.Contrast(image).enhance(factor))

    # 背景除去
    def _apply_background_removal(self, image: Image.Image, _: ImageOperationParameters) -> ImageProcessingResult:
        # GrabCut アルゴリズムで前景マスクを生成し、RGBA の alpha チャンネルに適用する
        image_rgb = image.convert("RGB")
        cv_image = self._pil_to_cv(image_rgb)
        height, width = cv_image.shape[:2]
        # 画像の短辺 5% をマージンとして矩形領域を設定する
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
                5,  # イテレーション回数
                cv2.GC_INIT_WITH_RECT,
            )
        except cv2.error as exc:
            raise ImageProcessingError("背景除去に失敗しました。") from exc

        # 確実な前景 (GC_FGD) と前景の可能性がある領域 (GC_PR_FGD) を白にする
        alpha_mask = np.where(
            (mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD),
            255,
            0,
        ).astype("uint8")
        # モルフォロジー Opening でマスクのノイズ（細かい孤立点）を除去する
        cleaned_mask = cv2.morphologyEx(
            alpha_mask,
            cv2.MORPH_OPEN,
            np.ones((3, 3), np.uint8),
        )
        rgba_image = image_rgb.convert("RGBA")
        rgba_image.putalpha(Image.fromarray(cleaned_mask))
        foreground_ratio = float(np.count_nonzero(cleaned_mask)) / float(cleaned_mask.size)
        return ImageProcessingResult(
            image=rgba_image,
            analysis=ImageAnalysisResult(background_removal=BackgroundRemovalResult(foreground_ratio=foreground_ratio)),
            background_mask=Image.fromarray(cleaned_mask).convert("L"),
        )

    # OCR（光学式文字認識）
    def _apply_ocr(self, image: Image.Image, _: ImageOperationParameters) -> ImageProcessingResult:
        # OCR の実行は OcrService に委譲する
        try:
            execution_result = self._get_ocr_service().recognize(image)
        except (RuntimeError, OSError) as exc:
            logger.error("OCR 実行エラー: %s", exc)
            raise ImageProcessingError("OCR の実行に失敗しました。") from exc
        return ImageProcessingResult(
            image=execution_result.image,
            analysis=ImageAnalysisResult(ocr=execution_result.result),
        )

    # 物体検出
    def _apply_object_detection(self, image: Image.Image, parameters: ImageOperationParameters) -> ImageProcessingResult:
        # 物体検出は ObjectDetectionService（MobileNet SSD）に委譲する
        threshold = parameters.detection_threshold or 0.45
        try:
            execution_result = self._get_object_detection_service().detect(image, threshold)
        except (RuntimeError, OSError) as exc:
            logger.error("物体検出実行エラー: %s", exc)
            raise ImageProcessingError("物体検出の実行に失敗しました。") from exc
        return ImageProcessingResult(
            image=execution_result.image,
            analysis=ImageAnalysisResult(object_detection=execution_result.result),
        )

    # キャプション生成
    def _apply_caption_generation(self, image: Image.Image, _: ImageOperationParameters) -> ImageProcessingResult:
        # 輝度・向きなど画像の視覚的特徴からキャプション候補を生成する
        return ImageProcessingResult(
            image=image,
            analysis=ImageAnalysisResult(captions=CaptionResult(candidates=self._build_visual_caption_candidates(image))),
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
        brightness_label = "明るい" if luminance >= 180 else "落ち着いた" if luminance >= 100 else "暗めの"

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
                raise ImageProcessingError("object detection モデルが見つかりません。backend/app/models を確認してください。") from exc

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
