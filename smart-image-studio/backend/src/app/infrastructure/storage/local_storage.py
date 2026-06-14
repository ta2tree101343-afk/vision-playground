from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from uuid import uuid4

from PIL import Image

from app.utils.file_util import sanitize_stem

logger = logging.getLogger(__name__)

_ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tiff"}


@dataclass(frozen=True)
class StoredImage:
    filename: str
    public_path: str
    file_path: Path


class LocalImageStorage:
    def __init__(self, base_dir: Path) -> None:
        self.base_dir = base_dir
        self.originals_dir = self.base_dir / "originals"
        self.processed_dir = self.base_dir / "processed"
        self.masks_dir = self.base_dir / "masks"
        self.originals_dir.mkdir(parents=True, exist_ok=True)
        self.processed_dir.mkdir(parents=True, exist_ok=True)
        self.masks_dir.mkdir(parents=True, exist_ok=True)

    def save_original(self, image_bytes: bytes, original_filename: str) -> StoredImage:
        raw_ext = Path(original_filename).suffix.lower()
        extension = raw_ext if raw_ext in _ALLOWED_EXTENSIONS else ".bin"
        safe_stem = sanitize_stem(Path(original_filename).stem or "upload")
        filename = f"{uuid4().hex}_{safe_stem}{extension}"
        file_path = self.originals_dir / filename
        file_path.write_bytes(image_bytes)
        return StoredImage(filename=filename, public_path=f"/uploads/originals/{filename}", file_path=file_path)

    def save_processed(self, image: Image.Image, original_filename: str) -> StoredImage:
        safe_stem = sanitize_stem(Path(original_filename).stem or "upload")
        filename = f"{uuid4().hex}_{safe_stem}_processed.png"
        file_path = self.processed_dir / filename
        try:
            image.save(file_path, format="PNG")
        except (OSError, ValueError) as exc:
            raise OSError(f"加工後画像の保存に失敗しました ({file_path}): {exc}") from exc
        return StoredImage(filename=filename, public_path=f"/uploads/processed/{filename}", file_path=file_path)

    def save_background_mask(self, image: Image.Image, original_filename: str) -> StoredImage:
        safe_stem = sanitize_stem(Path(original_filename).stem or "upload")
        filename = f"{uuid4().hex}_{safe_stem}_mask.png"
        file_path = self.masks_dir / filename
        try:
            image.save(file_path, format="PNG")
        except (OSError, ValueError) as exc:
            raise OSError(f"背景マスク画像の保存に失敗しました ({file_path}): {exc}") from exc
        return StoredImage(filename=filename, public_path=f"/uploads/masks/{filename}", file_path=file_path)
