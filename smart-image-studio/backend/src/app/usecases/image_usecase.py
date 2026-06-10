from fastapi import Request

from app.schemas.image import ImageOperationStep, ProcessImageResponse
from app.services.image_processor import ImageProcessor
from app.services.storage_service import StorageService, save_and_build_response


class ImageUsecase:
    def __init__(self, image_processor: ImageProcessor, storage_service: StorageService) -> None:
        self._image_processor = image_processor
        self._storage_service = storage_service

    def process(
        self,
        *,
        request: Request,
        image_bytes: bytes,
        filename: str,
        steps: list[ImageOperationStep],
    ) -> ProcessImageResponse:
        original_file = self._storage_service.save_original(image_bytes, filename)
        processing_result = self._image_processor.process(image_bytes, steps)
        return save_and_build_response(
            self._storage_service,
            processed_image=processing_result.image,
            analysis=processing_result.analysis,
            background_mask=processing_result.background_mask,
            filename=filename,
            base_url=str(request.base_url),
            original_public_path=original_file.public_path,
            operations=steps,
        )
