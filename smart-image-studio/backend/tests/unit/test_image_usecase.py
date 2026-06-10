from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock

from PIL import Image
from fastapi import Request

from app.infrastructure.storage.local_storage import StoredImage
from app.schemas.image import ImageOperationStep, OperationType, ProcessImageResponse
from app.services.image_processor import ImageProcessor, ImageProcessingResult
from app.services.storage_service import StorageService
from app.usecases.image_usecase import ImageUsecase
from conftest import make_png_bytes


def _make_request() -> Request:
    scope = {
        "type": "http",
        "method": "POST",
        "path": "/api/images/process",
        "query_string": b"",
        "headers": [],
        "server": ("localhost", 8000),
    }
    return Request(scope)


def _ops() -> list[ImageOperationStep]:
    return [ImageOperationStep(operation=OperationType.GRAYSCALE)]


def _setup(tmp_path: Path) -> tuple[ImageUsecase, MagicMock, MagicMock]:
    image_processor = MagicMock(spec=ImageProcessor)
    storage_service = MagicMock(spec=StorageService)
    usecase = ImageUsecase(image_processor, storage_service)

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

    return usecase, image_processor, storage_service


def test_process_returns_process_image_response(tmp_path: Path) -> None:
    usecase, _, _ = _setup(tmp_path)
    result = usecase.process(request=_make_request(), image_bytes=make_png_bytes(4, 4), filename="photo.png", steps=_ops())
    assert isinstance(result, ProcessImageResponse)


def test_process_original_url_contains_originals_path(tmp_path: Path) -> None:
    usecase, _, _ = _setup(tmp_path)
    result = usecase.process(request=_make_request(), image_bytes=make_png_bytes(4, 4), filename="photo.png", steps=_ops())
    assert "/uploads/originals/" in result.original_image_url


def test_process_processed_url_contains_processed_path(tmp_path: Path) -> None:
    usecase, _, _ = _setup(tmp_path)
    result = usecase.process(request=_make_request(), image_bytes=make_png_bytes(4, 4), filename="photo.png", steps=_ops())
    assert "/uploads/processed/" in result.processed_image_url


def test_process_calls_image_processor_with_given_steps(tmp_path: Path) -> None:
    usecase, image_processor, _ = _setup(tmp_path)
    steps = _ops()
    usecase.process(request=_make_request(), image_bytes=make_png_bytes(4, 4), filename="photo.png", steps=steps)
    image_processor.process.assert_called_once()
    _, call_kwargs = image_processor.process.call_args
    assert call_kwargs is None or image_processor.process.call_args[0][1] == steps


def test_process_saves_original_before_processing(tmp_path: Path) -> None:
    usecase, image_processor, storage_service = _setup(tmp_path)
    usecase.process(request=_make_request(), image_bytes=make_png_bytes(4, 4), filename="photo.png", steps=_ops())
    storage_service.save_original.assert_called_once()
    storage_service.save_processed.assert_called_once()


def test_process_analysis_is_none_when_processor_returns_none(tmp_path: Path) -> None:
    usecase, _, _ = _setup(tmp_path)
    result = usecase.process(request=_make_request(), image_bytes=make_png_bytes(4, 4), filename="photo.png", steps=_ops())
    assert result.analysis is None
