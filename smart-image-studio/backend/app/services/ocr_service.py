from dataclasses import dataclass

import numpy as np
from PIL import Image, ImageDraw
from rapidocr_onnxruntime import RapidOCR

from app.schemas.image import BoundingBox, OcrLine, OcrResult


@dataclass(frozen=True)
class OcrExecutionResult:
    image: Image.Image
    result: OcrResult


class OcrService:
    def __init__(self) -> None:
        self._engine = RapidOCR()

    def recognize(self, image: Image.Image) -> OcrExecutionResult:
        image_rgb = image.convert("RGB")
        image_array = np.array(image_rgb)
        result, _ = self._engine(image_array)

        if not result:
            return OcrExecutionResult(
                image=image_rgb, result=OcrResult(full_text="", lines=[])
            )

        annotated_image = image_rgb.copy()
        drawer = ImageDraw.Draw(annotated_image)
        lines: list[OcrLine] = []

        for item in result:
            points, text, confidence = item
            bounding_box = self._points_to_bounding_box(points)
            lines.append(
                OcrLine(
                    text=str(text).strip(),
                    confidence=float(confidence),
                    bounding_box=bounding_box,
                )
            )
            drawer.polygon(
                [tuple(point) for point in points], outline="#0f766e", width=3
            )
            self._draw_label(drawer, bounding_box, f"OCR {str(text).strip()}")

        full_text = "\n".join(line.text for line in lines if line.text)
        return OcrExecutionResult(
            image=annotated_image,
            result=OcrResult(full_text=full_text, lines=lines),
        )

    @staticmethod
    def _points_to_bounding_box(points: list[list[float]]) -> BoundingBox:
        x_values = [point[0] for point in points]
        y_values = [point[1] for point in points]
        min_x = int(max(0, min(x_values)))
        min_y = int(max(0, min(y_values)))
        max_x = int(max(x_values))
        max_y = int(max(y_values))
        return BoundingBox(
            x=min_x,
            y=min_y,
            width=max(0, max_x - min_x),
            height=max(0, max_y - min_y),
        )

    @staticmethod
    def _draw_label(drawer: ImageDraw.ImageDraw, box: BoundingBox, text: str) -> None:
        label_top = max(0, box.y - 18)
        label_bottom = label_top + 18
        drawer.rectangle((box.x, label_top, box.x + 140, label_bottom), fill="#0f766e")
        drawer.text((box.x + 6, label_top + 3), text[:22], fill="white")
