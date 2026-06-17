from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock

import pytest
from PIL import Image

from app.infrastructure.storage.local_storage import LocalImageStorage


def _blank_image() -> Image.Image:
    return Image.new("RGB", (10, 10), color=(128, 128, 128))


# --- __init__ ---


def test_init_creates_subdirectories(tmp_path: Path) -> None:
    LocalImageStorage(tmp_path)
    assert (tmp_path / "originals").is_dir()
    assert (tmp_path / "processed").is_dir()
    assert (tmp_path / "masks").is_dir()


# --- save_original ---


def test_save_original_writes_bytes_to_disk(tmp_path: Path) -> None:
    storage = LocalImageStorage(tmp_path)
    data = b"binary content"
    result = storage.save_original(data, "photo.png")
    assert result.file_path.read_bytes() == data


def test_save_original_allowed_extension_preserved(tmp_path: Path) -> None:
    storage = LocalImageStorage(tmp_path)
    result = storage.save_original(b"x", "photo.jpeg")
    assert result.filename.endswith(".jpeg")


def test_save_original_unknown_extension_becomes_bin(tmp_path: Path) -> None:
    storage = LocalImageStorage(tmp_path)
    result = storage.save_original(b"x", "photo.xyz")
    assert result.filename.endswith(".bin")


def test_save_original_no_extension_becomes_bin(tmp_path: Path) -> None:
    storage = LocalImageStorage(tmp_path)
    result = storage.save_original(b"x", "photo")
    assert result.filename.endswith(".bin")


def test_save_original_safe_stem_appears_in_filename(tmp_path: Path) -> None:
    storage = LocalImageStorage(tmp_path)
    # sanitize_stem: "my photo" -> "my-photo"
    result = storage.save_original(b"x", "my photo.png")
    assert "my-photo" in result.filename


def test_save_original_empty_filename_stem_falls_back_to_upload(tmp_path: Path) -> None:
    storage = LocalImageStorage(tmp_path)
    # Path("").stem == "" → "" or "upload" → sanitize_stem("upload") → "upload"
    result = storage.save_original(b"x", "")
    assert "upload" in result.filename


def test_save_original_public_path_prefix(tmp_path: Path) -> None:
    storage = LocalImageStorage(tmp_path)
    result = storage.save_original(b"x", "photo.png")
    assert result.public_path.startswith("/uploads/originals/")


def test_save_original_public_path_contains_filename(tmp_path: Path) -> None:
    storage = LocalImageStorage(tmp_path)
    result = storage.save_original(b"x", "photo.png")
    assert result.public_path.endswith(result.filename)


# --- save_processed ---


def test_save_processed_writes_png_to_disk(tmp_path: Path) -> None:
    storage = LocalImageStorage(tmp_path)
    result = storage.save_processed(_blank_image(), "photo.png")
    assert result.file_path.exists()
    assert Image.open(result.file_path).format == "PNG"


def test_save_processed_filename_ends_with_processed_png(tmp_path: Path) -> None:
    storage = LocalImageStorage(tmp_path)
    result = storage.save_processed(_blank_image(), "photo.png")
    assert result.filename.endswith("_processed.png")


def test_save_processed_public_path_prefix(tmp_path: Path) -> None:
    storage = LocalImageStorage(tmp_path)
    result = storage.save_processed(_blank_image(), "photo.png")
    assert result.public_path.startswith("/uploads/processed/")


def test_save_processed_raises_oserror_with_message_on_failure(tmp_path: Path) -> None:
    storage = LocalImageStorage(tmp_path)
    broken = MagicMock(spec=Image.Image)
    broken.save.side_effect = OSError("disk full")
    with pytest.raises(OSError, match="加工後画像の保存に失敗しました"):
        storage.save_processed(broken, "photo.png")


# --- save_background_mask ---


def test_save_background_mask_filename_ends_with_mask_png(tmp_path: Path) -> None:
    storage = LocalImageStorage(tmp_path)
    result = storage.save_background_mask(_blank_image(), "photo.png")
    assert result.filename.endswith("_mask.png")


def test_save_background_mask_public_path_prefix(tmp_path: Path) -> None:
    storage = LocalImageStorage(tmp_path)
    result = storage.save_background_mask(_blank_image(), "photo.png")
    assert result.public_path.startswith("/uploads/masks/")


def test_save_background_mask_raises_oserror_with_message_on_failure(tmp_path: Path) -> None:
    storage = LocalImageStorage(tmp_path)
    broken = MagicMock(spec=Image.Image)
    broken.save.side_effect = OSError("disk full")
    with pytest.raises(OSError, match="背景マスク画像の保存に失敗しました"):
        storage.save_background_mask(broken, "photo.png")
