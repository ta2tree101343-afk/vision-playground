from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock

import pytest
from conftest import make_png_bytes
from fastapi import HTTPException
from PIL import Image

from app.controllers.image_controller import ImageController
from app.core.exceptions import ImageProcessingError, ModelNotAvailableError
from app.infrastructure.storage.local_storage import StoredImage
from app.schemas.image import ProcessImageResponse
from app.services.image_processor import ImageProcessingResult, ImageProcessor
from app.services.storage_service import StorageService

_GRAYSCALE_OPS = '[{"operation":"grayscale"}]'


def _setup(tmp_path: Path) -> tuple[ImageController, MagicMock, MagicMock]:
    image_processor = MagicMock(spec=ImageProcessor)
    storage_service = MagicMock(spec=StorageService)
    controller = ImageController(image_processor, storage_service)

    src = tmp_path / "orig.png"
    src.write_bytes(make_png_bytes(4, 4))
    dst = tmp_path / "dst.png"
    dst.write_bytes(make_png_bytes(4, 4))

    storage_service.save_original.return_value = StoredImage(
        filename="orig.png", public_path="/uploads/originals/orig.png", file_path=src
    )
    storage_service.save_processed.return_value = StoredImage(
        filename="dst.png", public_path="/uploads/processed/dst.png", file_path=dst
    )
    img = Image.new("RGB", (4, 4))
    image_processor.process.return_value = ImageProcessingResult(image=img, analysis=None, background_mask=None)

    return controller, image_processor, storage_service


def test_process_returns_process_image_response(tmp_path: Path) -> None:
    controller, _, _ = _setup(tmp_path)
    result = controller.process_image(
        image_bytes=make_png_bytes(4, 4), filename="photo.png", operations=_GRAYSCALE_OPS
    )
    assert isinstance(result, ProcessImageResponse)


def test_process_original_url_contains_originals_path(tmp_path: Path) -> None:
    controller, _, _ = _setup(tmp_path)
    result = controller.process_image(
        image_bytes=make_png_bytes(4, 4), filename="photo.png", operations=_GRAYSCALE_OPS
    )
    assert "/uploads/originals/" in result.original_image_url


def test_process_processed_url_contains_processed_path(tmp_path: Path) -> None:
    controller, _, _ = _setup(tmp_path)
    result = controller.process_image(
        image_bytes=make_png_bytes(4, 4), filename="photo.png", operations=_GRAYSCALE_OPS
    )
    assert "/uploads/processed/" in result.processed_image_url


def test_process_calls_image_processor_with_given_steps(tmp_path: Path) -> None:
    controller, image_processor, _ = _setup(tmp_path)
    controller.process_image(
        image_bytes=make_png_bytes(4, 4), filename="photo.png", operations=_GRAYSCALE_OPS
    )
    image_processor.process.assert_called_once()


def test_process_saves_original_before_processing(tmp_path: Path) -> None:
    controller, _, storage_service = _setup(tmp_path)
    controller.process_image(
        image_bytes=make_png_bytes(4, 4), filename="photo.png", operations=_GRAYSCALE_OPS
    )
    storage_service.save_original.assert_called_once()
    storage_service.save_processed.assert_called_once()


def test_process_analysis_is_none_when_processor_returns_none(tmp_path: Path) -> None:
    controller, _, _ = _setup(tmp_path)
    result = controller.process_image(
        image_bytes=make_png_bytes(4, 4), filename="photo.png", operations=_GRAYSCALE_OPS
    )
    assert result.analysis is None


def test_model_not_available_error_raises_503(tmp_path: Path) -> None:
    controller, image_processor, _ = _setup(tmp_path)
    image_processor.process.side_effect = ModelNotAvailableError("caffemodel not found")

    with pytest.raises(HTTPException) as exc_info:
        controller.process_image(
            image_bytes=make_png_bytes(4, 4), filename="photo.png", operations=_GRAYSCALE_OPS
        )
    assert exc_info.value.status_code == 503


def test_model_not_available_detail_does_not_leak_internals(tmp_path: Path) -> None:
    controller, image_processor, _ = _setup(tmp_path)
    image_processor.process.side_effect = ModelNotAvailableError("caffemodel not found")

    with pytest.raises(HTTPException) as exc_info:
        controller.process_image(
            image_bytes=make_png_bytes(4, 4), filename="photo.png", operations=_GRAYSCALE_OPS
        )
    assert "caffemodel not found" not in exc_info.value.detail


def test_image_processing_error_raises_500(tmp_path: Path) -> None:
    controller, image_processor, _ = _setup(tmp_path)
    image_processor.process.side_effect = ImageProcessingError("internal error detail")

    with pytest.raises(HTTPException) as exc_info:
        controller.process_image(
            image_bytes=make_png_bytes(4, 4), filename="photo.png", operations=_GRAYSCALE_OPS
        )
    assert exc_info.value.status_code == 500
    assert "internal error detail" not in exc_info.value.detail
