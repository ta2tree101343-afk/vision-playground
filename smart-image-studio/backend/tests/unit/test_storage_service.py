from pathlib import Path
from unittest.mock import patch

import pytest
from PIL import Image

from app.core.exceptions import MaskSaveError
from app.schemas.image import BackgroundRemovalResult, ImageAnalysisResult
from app.services.storage_service import StorageService, attach_analysis_assets


def _gray_image() -> Image.Image:
    return Image.new("L", (4, 4))


def _rgb_image() -> Image.Image:
    return Image.new("RGB", (4, 4), color=(128, 0, 0))


def test_save_original_writes_bytes(tmp_path: Path) -> None:
    svc = StorageService(tmp_path)
    data = b"fake image bytes"
    stored = svc.save_original(data, "photo.jpg")
    assert Path(stored.file_path).read_bytes() == data
    assert stored.public_path.startswith("/uploads/originals/")
    assert stored.public_path.endswith(".jpg")


def test_save_processed_creates_png(tmp_path: Path) -> None:
    svc = StorageService(tmp_path)
    stored = svc.save_processed(_rgb_image(), "photo.png")
    assert Path(stored.file_path).exists()
    assert stored.public_path.startswith("/uploads/processed/")
    assert stored.public_path.endswith(".png")


def test_save_background_mask_creates_png(tmp_path: Path) -> None:
    svc = StorageService(tmp_path)
    stored = svc.save_background_mask(_gray_image(), "photo.png")
    assert Path(stored.file_path).exists()
    assert stored.public_path.startswith("/uploads/masks/")


def test_attach_analysis_assets_none_analysis_returns_none(tmp_path: Path) -> None:
    svc = StorageService(tmp_path)
    result = attach_analysis_assets(svc, analysis=None, background_mask=None, filename="x.png", base_url="http://localhost/")
    assert result is None


def test_attach_analysis_assets_analysis_without_bg_removal_unchanged(tmp_path: Path) -> None:
    svc = StorageService(tmp_path)
    analysis = ImageAnalysisResult()
    result = attach_analysis_assets(svc, analysis=analysis, background_mask=None, filename="x.png", base_url="http://localhost/")
    assert result is analysis


def test_attach_analysis_assets_bg_removal_without_mask_unchanged(tmp_path: Path) -> None:
    svc = StorageService(tmp_path)
    bg = BackgroundRemovalResult(foreground_ratio=0.5)
    analysis = ImageAnalysisResult(background_removal=bg)
    result = attach_analysis_assets(svc, analysis=analysis, background_mask=None, filename="x.png", base_url="http://localhost/")
    assert result is analysis


def test_attach_analysis_assets_sets_mask_url(tmp_path: Path) -> None:
    svc = StorageService(tmp_path)
    bg = BackgroundRemovalResult(foreground_ratio=0.5)
    analysis = ImageAnalysisResult(background_removal=bg)
    result = attach_analysis_assets(
        svc, analysis=analysis, background_mask=_gray_image(), filename="x.png", base_url="http://localhost:8000/"
    )
    assert result is not None
    assert result.background_removal is not None
    assert result.background_removal.mask_image_url is not None
    assert "masks" in result.background_removal.mask_image_url
    assert result.background_removal.mask_image_url.startswith("http://localhost:8000")


def test_attach_analysis_assets_raises_mask_save_error_on_os_error(tmp_path: Path) -> None:
    svc = StorageService(tmp_path)
    bg = BackgroundRemovalResult(foreground_ratio=0.5)
    analysis = ImageAnalysisResult(background_removal=bg)
    with patch.object(svc, "save_background_mask", side_effect=OSError("disk full")):
        with pytest.raises(MaskSaveError):
            attach_analysis_assets(svc, analysis=analysis, background_mask=_gray_image(), filename="x.png", base_url="http://localhost/")
