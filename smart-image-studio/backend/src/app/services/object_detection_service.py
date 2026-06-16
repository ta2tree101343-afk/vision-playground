import logging
from pathlib import Path

import cv2  # type: ignore
from PIL import Image

from app.core.exceptions import ImageProcessingError, ModelNotAvailableError
from app.infrastructure.object_detection.mobilenet_ssd_detector import MobileNetSSDDetector, ObjectDetectionExecutionResult

logger = logging.getLogger(__name__)


class ObjectDetectionService:
    def __init__(self, models_dir: Path) -> None:
        self._detector: MobileNetSSDDetector | None = None
        try:
            self._detector = MobileNetSSDDetector(models_dir)
        except (FileNotFoundError, RuntimeError):
            logger.warning("物体検出モデルが見つかりません。object_detection 操作は HTTP 503 を返します。")

    def detect(self, image: Image.Image, threshold: float = 0.45) -> ObjectDetectionExecutionResult:
        if self._detector is None:
            raise ModelNotAvailableError("物体検出モデルが配置されていません。")
        try:
            return self._detector.detect(image, threshold)
        except (RuntimeError, OSError, cv2.error) as exc:
            raise ImageProcessingError("物体検出の実行に失敗しました。") from exc
