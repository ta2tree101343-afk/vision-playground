from functools import lru_cache

from app.controllers.image_controller import ImageController
from app.controllers.job_controller import JobController
from app.core.config import get_settings
from app.repositories.job_repository import JobRepository
from app.services.caption_service import CaptionService
from app.services.image_processor import ImageProcessor
from app.services.job_service import JobService
from app.services.object_detection_service import ObjectDetectionService
from app.services.ocr_service import OcrService
from app.services.storage_service import StorageService


@lru_cache
def get_ocr_service() -> OcrService:
    return OcrService()


@lru_cache
def get_object_detection_service() -> ObjectDetectionService:
    return ObjectDetectionService(get_settings().ml_models_path)


@lru_cache
def get_caption_service() -> CaptionService:
    from app.infrastructure.llm.lm_studio_client import LmStudioVisionClient

    settings = get_settings()
    client = LmStudioVisionClient(settings.llm_api_base_url, settings.llm_model, settings.llm_api_key)
    return CaptionService(client)


@lru_cache
def get_image_processor() -> ImageProcessor:
    return ImageProcessor(
        ocr_service_factory=get_ocr_service,
        object_detection_service_factory=get_object_detection_service,
        caption_service_factory=get_caption_service,
    )


@lru_cache
def get_storage_service() -> StorageService:
    settings = get_settings()
    return StorageService(settings.upload_path)


@lru_cache
def get_job_repository() -> JobRepository:
    from app.db.engine import make_session_factory

    return JobRepository(make_session_factory(get_settings().database_url))


@lru_cache
def get_job_service() -> JobService:
    return JobService(
        image_processor=get_image_processor(),
        storage_service=get_storage_service(),
        job_repository=get_job_repository(),
    )


@lru_cache
def get_image_controller() -> ImageController:
    return ImageController(get_image_processor(), get_storage_service())


@lru_cache
def get_job_controller() -> JobController:
    return JobController(get_job_service())
