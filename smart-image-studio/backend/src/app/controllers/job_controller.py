from fastapi import HTTPException, Request, status

from app.core.exceptions import JobNotFoundError, JobQueueFullError
from app.schemas.job import ImageProcessJob
from app.services.job_service import JobService
from app.validators.pipeline_validator import parse_operation_steps


class JobController:
    def __init__(self, job_service: JobService) -> None:
        self._job_service = job_service

    async def create_job(
        self,
        *,
        request: Request,
        image_bytes: bytes,
        filename: str,
        operations: str,
    ) -> ImageProcessJob:
        steps = parse_operation_steps(operations)
        try:
            return await self._job_service.enqueue_job(
                image_bytes=image_bytes,
                filename=filename,
                base_url=str(request.base_url),
                operations=steps,
            )
        except JobQueueFullError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="ジョブキューが満杯です。しばらく後に再試行してください。",
            ) from exc

    def list_jobs(self) -> list[ImageProcessJob]:
        return self._job_service.list_jobs()

    def get_job(self, job_id: str) -> ImageProcessJob:
        try:
            return self._job_service.get_job(job_id)
        except JobNotFoundError:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="指定されたジョブが見つかりません。")
