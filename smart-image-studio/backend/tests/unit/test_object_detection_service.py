"""ObjectDetectionService の遅延初期化と ModelNotAvailableError のテスト。"""

from __future__ import annotations

from pathlib import Path

import pytest
from PIL import Image

from app.core.exceptions import ModelNotAvailableError
from app.services.object_detection_service import ObjectDetectionService


def _blank_image() -> Image.Image:
    return Image.new("RGB", (20, 20), color=(100, 100, 100))


class TestObjectDetectionServiceLazyInit:
    def test_init_with_missing_dir_does_not_raise(self, tmp_path: Path) -> None:
        empty_dir = tmp_path / "no_models"
        empty_dir.mkdir()
        # caffemodel がなくても起動時に例外を送出しない
        svc = ObjectDetectionService(empty_dir)
        assert svc._detector is None

    def test_detect_raises_model_not_available_when_no_model(self, tmp_path: Path) -> None:
        empty_dir = tmp_path / "no_models"
        empty_dir.mkdir()
        svc = ObjectDetectionService(empty_dir)

        with pytest.raises(ModelNotAvailableError):
            svc.detect(_blank_image())

    def test_detect_raises_model_not_available_not_image_processing_error(self, tmp_path: Path) -> None:
        """ModelNotAvailableError は ImageProcessingError とは別の例外でなければならない。"""
        from app.core.exceptions import ImageProcessingError

        empty_dir = tmp_path / "no_models"
        empty_dir.mkdir()
        svc = ObjectDetectionService(empty_dir)

        with pytest.raises(ModelNotAvailableError):
            svc.detect(_blank_image())

        # ImageProcessingError のサブクラスではないことを確認
        assert not issubclass(ModelNotAvailableError, ImageProcessingError)
