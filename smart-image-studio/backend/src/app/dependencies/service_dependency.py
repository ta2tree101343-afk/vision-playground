from functools import lru_cache

from app.core.config import get_settings
from app.repositories.job_repository import JobRepository
from app.services.image_processor import ImageProcessor
from app.services.job_service import JobService
from app.services.storage_service import StorageService
from app.usecases.image_usecase import ImageUsecase


@lru_cache
def get_image_processor() -> ImageProcessor:
    return ImageProcessor()


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


def get_image_usecase() -> ImageUsecase:
    return ImageUsecase(get_image_processor(), get_storage_service())
