import re
from dataclasses import dataclass
from pathlib import Path
from uuid import uuid4

from PIL import Image


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
        extension = Path(original_filename).suffix.lower() or ".bin"
        safe_stem = self._sanitize_stem(Path(original_filename).stem or "upload")
        filename = f"{uuid4().hex}_{safe_stem}{extension}"
        file_path = self.originals_dir / filename
        file_path.write_bytes(image_bytes)

        return StoredImage(
            filename=filename,
            public_path=f"/uploads/originals/{filename}",
            file_path=file_path,
        )

    def save_processed(self, image: Image.Image, original_filename: str) -> StoredImage:
        safe_stem = self._sanitize_stem(Path(original_filename).stem or "upload")
        filename = f"{uuid4().hex}_{safe_stem}_processed.png"
        file_path = self.processed_dir / filename
        image.save(file_path, format="PNG")

        return StoredImage(
            filename=filename,
            public_path=f"/uploads/processed/{filename}",
            file_path=file_path,
        )

    def save_background_mask(self, image: Image.Image, original_filename: str) -> StoredImage:
        safe_stem = self._sanitize_stem(Path(original_filename).stem or "upload")
        filename = f"{uuid4().hex}_{safe_stem}_mask.png"
        file_path = self.masks_dir / filename
        image.save(file_path, format="PNG")
        return StoredImage(
            filename=filename,
            public_path=f"/uploads/masks/{filename}",
            file_path=file_path,
        )

    @staticmethod
    def _sanitize_stem(stem: str) -> str:
        normalized = re.sub(r"[^a-zA-Z0-9_-]+", "-", stem).strip("-")
        return normalized or "image"
