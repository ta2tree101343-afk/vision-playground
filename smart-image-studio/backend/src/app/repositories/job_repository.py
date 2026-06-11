import logging
from collections.abc import Callable
from contextlib import AbstractContextManager

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.job_model import JobModel
from app.schemas.job import ImageProcessJob
from app.utils.datetime_util import utc_now

logger = logging.getLogger(__name__)

_SessionFactory = Callable[[], AbstractContextManager[Session]]


def _to_domain(row: JobModel) -> ImageProcessJob:
    return ImageProcessJob.model_validate({
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
    })


def _from_domain(job: ImageProcessJob) -> JobModel:
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
            return _to_domain(row) if row is not None else None

    def save(self, job: ImageProcessJob, *, persist: bool = True) -> None:
        with self._session_factory() as session:
            session.merge(_from_domain(job))
            session.commit()

    def list_recent(self, limit: int) -> list[ImageProcessJob]:
        with self._session_factory() as session:
            rows = session.scalars(
                select(JobModel).order_by(JobModel.created_at.desc()).limit(limit)
            ).all()
            return [_to_domain(r) for r in rows]

    def remove(self, job_id: str) -> None:
        with self._session_factory() as session:
            if row := session.get(JobModel, job_id):
                session.delete(row)
                session.commit()

    def mark_interrupted_jobs(self) -> None:
        interrupted_at = utc_now()
        with self._session_factory() as session:
            rows = session.scalars(
                select(JobModel).where(JobModel.status.in_(["queued", "running"]))
            ).all()
            for row in rows:
                row.status = "failed"
                row.completed_at = interrupted_at
                row.message = "サーバー再起動によりジョブが中断しました。"
                row.error_message = "サーバー再起動によりジョブが中断しました。"
                if row.started_at is None:
                    row.started_at = interrupted_at
            session.commit()
