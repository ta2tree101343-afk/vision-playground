from pathlib import Path

import cv2  # type: ignore
from PIL import Image

from app.core.exceptions import ImageProcessingError
from app.infrastructure.object_detection.mobilenet_ssd_detector import MobileNetSSDDetector, ObjectDetectionExecutionResult


class ObjectDetectionService:
    def __init__(self, models_dir: Path) -> None:
        try:
            self._detector = MobileNetSSDDetector(models_dir)
        except (FileNotFoundError, RuntimeError) as exc:
            raise ImageProcessingError("object detection モデルの初期化に失敗しました。assets/ml_models を確認してください。") from exc

    def detect(self, image: Image.Image, threshold: float = 0.45) -> ObjectDetectionExecutionResult:
        try:
            return self._detector.detect(image, threshold)
        except (RuntimeError, OSError, cv2.error) as exc:
            raise ImageProcessingError("物体検出の実行に失敗しました。") from exc
