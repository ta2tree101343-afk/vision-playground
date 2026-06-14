import logging
import threading
from dataclasses import dataclass
from pathlib import Path

import cv2  # type: ignore
import numpy as np  # type: ignore
from PIL import Image, ImageDraw

from app.schemas.image import BoundingBox, DetectedObject, ObjectDetectionResult
from app.utils.annotation_util import draw_label

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ObjectDetectionExecutionResult:
    overlay: Image.Image
    result: ObjectDetectionResult


class MobileNetSSDDetector:
    class_labels = [
        "background",
        "aeroplane",
        "bicycle",
        "bird",
        "boat",
        "bottle",
        "bus",
        "car",
        "cat",
        "chair",
        "cow",
        "diningtable",
        "dog",
        "horse",
        "motorbike",
        "person",
        "pottedplant",
        "sheep",
        "sofa",
        "train",
        "tvmonitor",
    ]

    def __init__(self, models_dir: Path) -> None:
        prototxt_path = models_dir / "MobileNetSSD_deploy.prototxt"
        weights_path = models_dir / "mobilenet_iter_73000.caffemodel"
        if not prototxt_path.exists() or not weights_path.exists():
            raise RuntimeError(
                f"物体検出モデルが見つかりません。'{models_dir}' に "
                "MobileNetSSD_deploy.prototxt と mobilenet_iter_73000.caffemodel を配置してください。"
                " caffemodel は https://github.com/chuanqi305/MobileNet-SSD のリリースから"
                "ダウンロードして同ディレクトリに置いてください (.gitignore で除外されています)。"
            )
        try:
            self._network = cv2.dnn.readNetFromCaffe(str(prototxt_path), str(weights_path))
        except Exception as exc:
            logger.exception("物体検出モデルの読み込みに失敗しました")
            raise RuntimeError(f"物体検出モデルの読み込みに失敗しました: {exc}") from exc
        self._lock = threading.Lock()

    def detect(self, image: Image.Image, threshold: float = 0.45) -> ObjectDetectionExecutionResult:
        image_rgb = image.convert("RGB")
        image_bgr = cv2.cvtColor(np.array(image_rgb), cv2.COLOR_RGB2BGR)
        height, width = image_bgr.shape[:2]
        blob = cv2.dnn.blobFromImage(cv2.resize(image_bgr, (300, 300)), scalefactor=0.007843, size=(300, 300), mean=127.5)
        with self._lock:
            self._network.setInput(blob)
            predictions = self._network.forward()

        detections: list[DetectedObject] = []
        annotated_image = image_rgb.copy()
        drawer = ImageDraw.Draw(annotated_image)

        for index in range(predictions.shape[2]):
            confidence = float(predictions[0, 0, index, 2])
            if confidence < threshold:
                continue
            class_index = int(predictions[0, 0, index, 1])
            if class_index >= len(self.class_labels):
                continue
            raw_box = predictions[0, 0, index, 3:7] * np.array([width, height, width, height])
            start_x, start_y, end_x, end_y = raw_box.astype("int")
            sx = max(0, min(start_x, width - 1))
            sy = max(0, min(start_y, height - 1))
            ex = max(sx, min(end_x, width - 1))
            ey = max(sy, min(end_y, height - 1))
            bounding_box = BoundingBox(x=sx, y=sy, width=max(1, ex - sx), height=max(1, ey - sy))
            label = self.class_labels[class_index]
            detections.append(DetectedObject(label=label, confidence=confidence, bounding_box=bounding_box))
            drawer.rectangle(
                (bounding_box.x, bounding_box.y, bounding_box.x + bounding_box.width, bounding_box.y + bounding_box.height),
                outline="#1d4ed8",
                width=3,
            )
            draw_label(drawer, bounding_box, f"{label} {confidence:.2f}", color="#1d4ed8", max_chars=24, label_width=144)

        return ObjectDetectionExecutionResult(
            overlay=annotated_image,
            result=ObjectDetectionResult(model="MobileNet SSD (VOC)", threshold=threshold, detections=detections),
        )
