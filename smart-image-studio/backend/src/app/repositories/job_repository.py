import logging
from collections.abc import Callable
from contextlib import AbstractContextManager
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.job_model import JobModel
from app.schemas.image import ProcessImageResponse
from app.schemas.job import ImageProcessJob, JobStatus
from app.utils.datetime_util import utc_now

logger = logging.getLogger(__name__)

_SessionFactory = Callable[[], AbstractContextManager[Session]]


def _to_schema(row: JobModel) -> ImageProcessJob:
    return ImageProcessJob.model_validate(
        {
            "job_id": row.job_id,
            "status": row.status,
            "progress": row.progress,
            "message": row.message,
            "filename": row.filename,
            "created_at": row.created_at,
            "started_at": row.started_at,
            "completed_at": row.completed_at,
            "applied_operations": row.applied_operations,
            "result": row.result,
            "error_message": row.error_message,
        }
    )


def _from_schema(job: ImageProcessJob) -> JobModel:
    return JobModel(
        job_id=job.job_id,
        status=job.status.value,
        progress=job.progress,
        message=job.message,
        filename=job.filename,
        created_at=job.created_at,
        started_at=job.started_at,
        completed_at=job.completed_at,
        applied_operations=job.model_dump(mode="json")["applied_operations"],
        result=job.result.model_dump(mode="json") if job.result is not None else None,
        error_message=job.error_message,
    )


class JobRepository:
    def __init__(self, session_factory: _SessionFactory) -> None:
        self._session_factory = session_factory

    def find(self, job_id: str) -> ImageProcessJob | None:
        with self._session_factory() as session:
            row = session.get(JobModel, job_id)
            return _to_schema(row) if row is not None else None

    def save(self, job: ImageProcessJob) -> None:
        with self._session_factory() as session:
            session.merge(_from_schema(job))
            session.commit()

    def update(
        self,
        job_id: str,
        *,
        status: JobStatus | None = None,
        progress: int | None = None,
        message: str | None = None,
        started_at: datetime | None = None,
        completed_at: datetime | None = None,
        result: ProcessImageResponse | None = None,
        error_message: str | None = None,
    ) -> None:
        with self._session_factory() as session:
            row = session.get(JobModel, job_id)
            if row is None:
                logger.error("update: job_id=%s が見つかりません。状態更新をスキップします。", job_id)
                return
            now = utc_now()
            if status is not None:
                row.status = status.value
            if progress is not None:
                row.progress = progress
            if message is not None:
                row.message = message
            if started_at is not None and row.started_at is None:
                row.started_at = started_at
            elif status in (JobStatus.RUNNING, JobStatus.COMPLETED, JobStatus.FAILED) and row.started_at is None:
                row.started_at = now
            if completed_at is not None:
                row.completed_at = completed_at
            elif status in (JobStatus.COMPLETED, JobStatus.FAILED) and row.completed_at is None:
                row.completed_at = now
            if result is not None:
                row.result = result.model_dump(mode="json")
            if error_message is not None or status == JobStatus.COMPLETED:
                row.error_message = error_message
            session.commit()

    def list_recent(self, limit: int) -> list[ImageProcessJob]:
        with self._session_factory() as session:
            rows = session.scalars(select(JobModel).order_by(JobModel.created_at.desc()).limit(limit)).all()
            return [_to_schema(r) for r in rows]

    def remove(self, job_id: str) -> None:
        with self._session_factory() as session:
            if row := session.get(JobModel, job_id):
                session.delete(row)
                session.commit()

    def mark_interrupted_jobs(self) -> None:
        interrupted_at = utc_now()
        with self._session_factory() as session:
            rows = session.scalars(select(JobModel).where(JobModel.status.in_(["queued", "running"]))).all()
            for row in rows:
                row.status = "failed"
                row.completed_at = interrupted_at
                row.message = "サーバー再起動によりジョブが中断しました。"
                row.error_message = "サーバー再起動によりジョブが中断しました。"
                if row.started_at is None:
                    row.started_at = interrupted_at
            session.commit()
