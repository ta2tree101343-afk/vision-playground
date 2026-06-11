import logging
from dataclasses import dataclass

import numpy as np  # type: ignore
from PIL import Image, ImageDraw
from rapidocr_onnxruntime import RapidOCR  # type: ignore

from app.core.exceptions import ImageProcessingError
from app.domain.image_models import BoundingBox, OcrLine, OcrResult
from app.utils.annotation_util import draw_label

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class OcrExecutionResult:
    overlay: Image.Image
    result: OcrResult


_DET_LIMIT_SIDE = 736  # RapidOCR's internal resize limit; pre-resize avoids detection failures on large images


class RapidOcrEngine:
    def __init__(self) -> None:
        try:
            self._engine = RapidOCR()
        except Exception as exc:
            logger.exception("OCR エンジンの初期化に失敗しました")
            raise ImageProcessingError("OCR エンジンの初期化に失敗しました。") from exc

    def recognize(self, image: Image.Image) -> OcrExecutionResult:
        image_rgb = image.convert("RGB")
        scale = min(_DET_LIMIT_SIDE / max(image_rgb.width, image_rgb.height), 1.0)
        ocr_image = image_rgb.resize((int(image_rgb.width * scale), int(image_rgb.height * scale))) if scale < 1.0 else image_rgb
        try:
            result, _ = self._engine(np.array(ocr_image))
        except MemoryError:
            raise
        except Exception as exc:
            raise ImageProcessingError("OCR エンジンの実行に失敗しました。") from exc

        if not result:
            return OcrExecutionResult(overlay=image_rgb, result=OcrResult(full_text="", lines=[]))

        annotated_image = image_rgb.copy()
        drawer = ImageDraw.Draw(annotated_image)
        lines: list[OcrLine] = []

        for item in result:
            raw_points, text, confidence = item
            points = [[p[0] / scale, p[1] / scale] for p in raw_points]
            bounding_box = self._points_to_bounding_box(points)
            lines.append(OcrLine(text=str(text).strip(), confidence=float(confidence), bounding_box=bounding_box))
            drawer.polygon([tuple(point) for point in points], outline="#0f766e", width=3)
            draw_label(drawer, bounding_box, f"OCR {str(text).strip()}", color="#0f766e", max_chars=22, label_width=140)

        full_text = "\n".join(line.text for line in lines if line.text)
        return OcrExecutionResult(overlay=annotated_image, result=OcrResult(full_text=full_text, lines=lines))

    @staticmethod
    def _points_to_bounding_box(points: list[list[float]]) -> BoundingBox:
        x_values = [point[0] for point in points]
        y_values = [point[1] for point in points]
        min_x = int(max(0, min(x_values)))
        min_y = int(max(0, min(y_values)))
        return BoundingBox(x=min_x, y=min_y, width=max(1, int(max(x_values)) - min_x), height=max(1, int(max(y_values)) - min_y))
