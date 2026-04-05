from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw

from app.schemas.image import BoundingBox, DetectedObject, ObjectDetectionResult


@dataclass(frozen=True)
class ObjectDetectionExecutionResult:
    image: Image.Image
    result: ObjectDetectionResult


class ObjectDetectionService:
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
        self._prototxt_path = models_dir / "MobileNetSSD_deploy.prototxt"
        self._weights_path = models_dir / "mobilenet_iter_73000.caffemodel"
        if not self._prototxt_path.exists() or not self._weights_path.exists():
            raise FileNotFoundError("物体検出モデルが見つかりません。")
        self._network = cv2.dnn.readNetFromCaffe(
            str(self._prototxt_path),
            str(self._weights_path),
        )

    def detect(
        self, image: Image.Image, threshold: float = 0.45
    ) -> ObjectDetectionExecutionResult:
        image_rgb = image.convert("RGB")
        image_bgr = cv2.cvtColor(np.array(image_rgb), cv2.COLOR_RGB2BGR)
        height, width = image_bgr.shape[:2]
        blob = cv2.dnn.blobFromImage(
            cv2.resize(image_bgr, (300, 300)),
            scalefactor=0.007843,
            size=(300, 300),
            mean=127.5,
        )
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
            clamped_start_x = max(0, min(start_x, width - 1))
            clamped_start_y = max(0, min(start_y, height - 1))
            clamped_end_x = max(clamped_start_x, min(end_x, width - 1))
            clamped_end_y = max(clamped_start_y, min(end_y, height - 1))
            bounding_box = BoundingBox(
                x=clamped_start_x,
                y=clamped_start_y,
                width=max(0, clamped_end_x - clamped_start_x),
                height=max(0, clamped_end_y - clamped_start_y),
            )
            label = self.class_labels[class_index]

            detections.append(
                DetectedObject(
                    label=label,
                    confidence=confidence,
                    bounding_box=bounding_box,
                )
            )
            drawer.rectangle(
                (
                    bounding_box.x,
                    bounding_box.y,
                    bounding_box.x + bounding_box.width,
                    bounding_box.y + bounding_box.height,
                ),
                outline="#1d4ed8",
                width=3,
            )
            self._draw_label(drawer, bounding_box, f"{label} {confidence:.2f}")

        return ObjectDetectionExecutionResult(
            image=annotated_image,
            result=ObjectDetectionResult(
                model="MobileNet SSD (VOC)",
                threshold=threshold,
                detections=detections,
            ),
        )

    @staticmethod
    def _draw_label(drawer: ImageDraw.ImageDraw, box: BoundingBox, text: str) -> None:
        label_top = max(0, box.y - 18)
        label_bottom = label_top + 18
        drawer.rectangle((box.x, label_top, box.x + 144, label_bottom), fill="#1d4ed8")
        drawer.text((box.x + 6, label_top + 3), text[:24], fill="white")
