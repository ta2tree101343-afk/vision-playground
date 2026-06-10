from __future__ import annotations

import logging
from pathlib import Path

from PIL import Image

from app.core.exceptions import MaskSaveError
from app.infrastructure.storage.local_storage import LocalImageStorage, StoredImage
from app.schemas.image import ImageAnalysisResult, ImageOperationStep, ProcessImageResponse
from app.utils.image_util import build_asset_url, build_process_response

logger = logging.getLogger(__name__)

__all__ = ["StorageService", "attach_analysis_assets", "save_and_build_response"]


class StorageService:
    def __init__(self, base_dir: Path) -> None:
        self._storage = LocalImageStorage(base_dir)

    def save_original(self, image_bytes: bytes, filename: str) -> StoredImage:
        return self._storage.save_original(image_bytes, filename)

    def save_processed(self, image: Image.Image, filename: str) -> StoredImage:
        return self._storage.save_processed(image, filename)

    def save_background_mask(self, image: Image.Image, filename: str) -> StoredImage:
        return self._storage.save_background_mask(image, filename)


def attach_analysis_assets(
    storage: StorageService,
    *,
    analysis: ImageAnalysisResult | None,
    background_mask: Image.Image | None,
    filename: str,
    base_url: str,
) -> ImageAnalysisResult | None:
    if analysis is None or background_mask is None or analysis.background_removal is None:
        if analysis is not None and analysis.background_removal is not None and background_mask is None:
            logger.warning(
                "attach_analysis_assets: background_mask が None です (filename=%r) — mask_image_url は null になります",
                filename,
            )
        return analysis

    try:
        mask_file = storage.save_background_mask(background_mask, filename)
    except OSError as exc:
        raise MaskSaveError(f"背景マスク画像の保存に失敗しました (filename={filename!r})") from exc

    return analysis.model_copy(
        update={
            "background_removal": analysis.background_removal.model_copy(
                update={"mask_image_url": build_asset_url(base_url, mask_file.public_path)}
            )
        }
    )


def save_and_build_response(
    storage: StorageService,
    *,
    processed_image: Image.Image,
    analysis: ImageAnalysisResult | None,
    background_mask: Image.Image | None,
    filename: str,
    base_url: str,
    original_public_path: str,
    operations: list[ImageOperationStep],
) -> ProcessImageResponse:
    processed_file = storage.save_processed(processed_image, filename)
    final_analysis = attach_analysis_assets(
        storage,
        analysis=analysis,
        background_mask=background_mask,
        filename=filename,
        base_url=base_url,
    )
    return build_process_response(
        base_url=base_url,
        original_public_path=original_public_path,
        processed_public_path=processed_file.public_path,
        processed_filename=processed_file.filename,
        operations=operations,
        analysis=final_analysis,
    )
