import logging

from fastapi import HTTPException, Request, status

from app.core.exceptions import ImageProcessingError, MaskSaveError
from app.schemas.image import ProcessImageResponse
from app.services.image_processor import ImageProcessor
from app.services.storage_service import StorageService, save_and_build_response
from app.validators.pipeline_validator import parse_operation_steps

logger = logging.getLogger(__name__)


class ImageController:
    def __init__(self, image_processor: ImageProcessor, storage_service: StorageService) -> None:
        self._image_processor = image_processor
        self._storage_service = storage_service

    def process_image(
        self,
        *,
        request: Request,
        image_bytes: bytes,
        filename: str,
        operations: str,
    ) -> ProcessImageResponse:
        steps = parse_operation_steps(operations)
        base_url = str(request.base_url)
        try:
            original_file = self._storage_service.save_original(image_bytes, filename)
            processing_result = self._image_processor.process(image_bytes, steps)
            return save_and_build_response(
                self._storage_service,
                processed_image=processing_result.image,
                analysis=processing_result.analysis,
                background_mask=processing_result.background_mask,
                filename=filename,
                base_url=base_url,
                original_public_path=original_file.public_path,
                operations=steps,
            )
        except ImageProcessingError as exc:
            logger.exception("画像処理に失敗しました (filename=%r): %s", filename, exc)
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"画像処理に失敗しました: {exc}") from exc
        except MaskSaveError as exc:
            logger.exception("背景マスクの保存に失敗しました: %s", exc)
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"背景マスクの保存に失敗しました: {exc}") from exc
        except OSError as exc:
            logger.exception("画像ファイルの保存に失敗しました: %s", exc)
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="画像ファイルの保存に失敗しました。") from exc
