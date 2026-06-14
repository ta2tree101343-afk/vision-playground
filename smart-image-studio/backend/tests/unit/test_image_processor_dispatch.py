"""ImageProcessor の _dispatch() パスをテストする。

各 AI オペレーション (OCR / 物体検出 / キャプション生成) でファクトリが呼ばれ、
返却値が analysis フィールドに正しくマッピングされることを確認する。
キャプション生成の例外スワロー分岐も検証する。
"""

from __future__ import annotations

import io
from unittest.mock import MagicMock

from PIL import Image

from app.core.exceptions import ImageProcessingError
from app.infrastructure.object_detection.mobilenet_ssd_detector import ObjectDetectionExecutionResult
from app.infrastructure.ocr.rapidocr import OcrExecutionResult
from app.schemas.image import (
    BoundingBox,
    CaptionCandidate,
    CaptionResult,
    DetectedObject,
    ImageOperationStep,
    ObjectDetectionResult,
    OcrLine,
    OcrResult,
    OperationType,
)
from app.services.caption_service import CaptionService
from app.services.image_processor import ImageProcessor
from app.services.object_detection_service import ObjectDetectionService
from app.services.ocr_service import OcrService


def _png_bytes() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (10, 10), color=(128, 128, 128)).save(buf, format="PNG")
    return buf.getvalue()


def _step(op: OperationType) -> ImageOperationStep:
    return ImageOperationStep(operation=op)


def _make_processor(
    ocr_factory=None,
    detection_factory=None,
    caption_factory=None,
) -> ImageProcessor:
    return ImageProcessor(
        ocr_service_factory=ocr_factory or (lambda: MagicMock(spec=OcrService)),
        object_detection_service_factory=detection_factory or (lambda: MagicMock(spec=ObjectDetectionService)),
        caption_service_factory=caption_factory or (lambda: MagicMock(spec=CaptionService)),
    )


def _stub_ocr_service() -> OcrService:
    svc = MagicMock(spec=OcrService)
    svc.recognize.return_value = OcrExecutionResult(
        overlay=Image.new("RGB", (10, 10)),
        result=OcrResult(
            full_text="hello",
            lines=[OcrLine(text="hello", confidence=0.9, bounding_box=BoundingBox(x=0, y=0, width=10, height=5))],
        ),
    )
    return svc


def _stub_detection_service() -> ObjectDetectionService:
    svc = MagicMock(spec=ObjectDetectionService)
    svc.detect.return_value = ObjectDetectionExecutionResult(
        overlay=Image.new("RGB", (10, 10)),
        result=ObjectDetectionResult(
            model="test",
            threshold=0.45,
            detections=[DetectedObject(label="cat", confidence=0.9, bounding_box=BoundingBox(x=0, y=0, width=5, height=5))],
        ),
    )
    return svc


def _stub_caption_service() -> CaptionService:
    svc = MagicMock(spec=CaptionService)
    svc.generate.return_value = CaptionResult(candidates=[CaptionCandidate(text="a cat on a mat", score=1.0)])
    return svc


# --- ファクトリ callable 接続テスト ---

def test_ocr_factory_is_called_and_result_mapped_to_analysis() -> None:
    ocr_factory = MagicMock(return_value=_stub_ocr_service())
    processor = _make_processor(ocr_factory=ocr_factory)

    result = processor.process(_png_bytes(), [_step(OperationType.OCR)])

    ocr_factory.assert_called_once()
    assert result.analysis is not None
    assert result.analysis.ocr is not None
    assert result.analysis.ocr.full_text == "hello"


def test_object_detection_factory_is_called_and_result_mapped_to_analysis() -> None:
    det_factory = MagicMock(return_value=_stub_detection_service())
    processor = _make_processor(detection_factory=det_factory)

    result = processor.process(_png_bytes(), [_step(OperationType.OBJECT_DETECTION)])

    det_factory.assert_called_once()
    assert result.analysis is not None
    assert result.analysis.object_detection is not None
    assert result.analysis.object_detection.detections[0].label == "cat"


def test_caption_factory_is_called_and_result_mapped_to_analysis() -> None:
    cap_factory = MagicMock(return_value=_stub_caption_service())
    processor = _make_processor(caption_factory=cap_factory)

    result = processor.process(_png_bytes(), [_step(OperationType.CAPTION_GENERATION)])

    cap_factory.assert_called_once()
    assert result.analysis is not None
    assert result.analysis.captions is not None
    assert result.analysis.captions.candidates[0].text == "a cat on a mat"


# --- CAPTION_GENERATION 例外スワロー分岐 ---

def test_caption_service_raising_image_processing_error_is_swallowed() -> None:
    cap_svc = MagicMock(spec=CaptionService)
    cap_svc.generate.side_effect = ImageProcessingError("LM Studio unavailable")
    processor = _make_processor(caption_factory=lambda: cap_svc)

    result = processor.process(_png_bytes(), [_step(OperationType.CAPTION_GENERATION)])

    assert result.analysis is not None
    assert result.analysis.captions is not None
    assert result.analysis.captions.error_message == "LM Studio unavailable"
    assert result.analysis.captions.candidates == []


def test_caption_factory_itself_raising_image_processing_error_is_swallowed() -> None:
    def failing_factory() -> CaptionService:
        raise ImageProcessingError("caption service init failed")

    processor = _make_processor(caption_factory=failing_factory)

    result = processor.process(_png_bytes(), [_step(OperationType.CAPTION_GENERATION)])

    assert result.analysis is not None
    assert result.analysis.captions is not None
    assert result.analysis.captions.error_message == "caption service init failed"
    assert result.analysis.captions.candidates == []


def test_ocr_factory_error_propagates_as_image_processing_error() -> None:
    """OCR/物体検出のファクトリエラーはスワローされず上位に伝播する。"""
    def failing_factory() -> OcrService:
        raise ImageProcessingError("OCR model not found")

    processor = _make_processor(ocr_factory=failing_factory)

    import pytest
    with pytest.raises(ImageProcessingError, match="OCR model not found"):
        processor.process(_png_bytes(), [_step(OperationType.OCR)])
