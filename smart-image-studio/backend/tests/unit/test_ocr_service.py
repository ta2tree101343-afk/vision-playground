from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from PIL import Image

from app.core.exceptions import ImageProcessingError
from app.infrastructure.ocr.rapidocr import OcrExecutionResult, RapidOcrEngine
from app.schemas.image import OcrResult


def _blank_image() -> Image.Image:
    return Image.new("RGB", (10, 10), color=(128, 128, 128))


def _empty_ocr_result() -> OcrExecutionResult:
    return OcrExecutionResult(
        overlay=Image.new("RGB", (10, 10)),
        result=OcrResult(full_text="", lines=[]),
    )


@pytest.fixture
def ocr_svc_and_engine() -> tuple:
    from app.services.ocr_service import OcrService

    mock_engine = MagicMock(spec=RapidOcrEngine)
    with patch("app.services.ocr_service.RapidOcrEngine", return_value=mock_engine):
        svc = OcrService()
    return svc, mock_engine


def test_recognize_returns_engine_result(ocr_svc_and_engine: tuple) -> None:
    svc, engine = ocr_svc_and_engine
    expected = _empty_ocr_result()
    engine.recognize.return_value = expected

    result = svc.recognize(_blank_image())

    assert result is expected


def test_recognize_passes_image_to_engine(ocr_svc_and_engine: tuple) -> None:
    svc, engine = ocr_svc_and_engine
    engine.recognize.return_value = _empty_ocr_result()
    image = _blank_image()

    svc.recognize(image)

    engine.recognize.assert_called_once_with(image)


def test_recognize_propagates_image_processing_error(ocr_svc_and_engine: tuple) -> None:
    svc, engine = ocr_svc_and_engine
    engine.recognize.side_effect = ImageProcessingError("OCR engine failed")

    with pytest.raises(ImageProcessingError, match="OCR engine failed"):
        svc.recognize(_blank_image())


def test_init_propagates_image_processing_error_from_engine_init() -> None:
    from app.services.ocr_service import OcrService

    with patch("app.services.ocr_service.RapidOcrEngine", side_effect=ImageProcessingError("OCR init failed")):
        with pytest.raises(ImageProcessingError, match="OCR init failed"):
            OcrService()
