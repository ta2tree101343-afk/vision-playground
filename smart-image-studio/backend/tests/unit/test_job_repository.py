from datetime import datetime, timezone

from app.repositories.job_repository import JobRepository
from app.schemas.image import ImageOperationStep, OperationType, ProcessImageResponse
from app.schemas.job import ImageProcessJob, JobStatus
from app.utils.datetime_util import utc_now


def _queued_job(job_id: str) -> ImageProcessJob:
    return ImageProcessJob(
        job_id=job_id,
        status=JobStatus.QUEUED,
        progress=0,
        message="queued",
        filename="test.jpg",
        created_at=utc_now(),
        applied_operations=[ImageOperationStep(operation=OperationType.GRAYSCALE)],
    )


def _running_job(job_id: str) -> ImageProcessJob:
    return ImageProcessJob(
        job_id=job_id,
        status=JobStatus.RUNNING,
        progress=50,
        message="running",
        filename="test.jpg",
        created_at=utc_now(),
        started_at=utc_now(),
        applied_operations=[ImageOperationStep(operation=OperationType.GRAYSCALE)],
    )


def _completed_job(job_id: str) -> ImageProcessJob:
    return ImageProcessJob(
        job_id=job_id,
        status=JobStatus.COMPLETED,
        progress=100,
        message="done",
        filename="test.jpg",
        created_at=utc_now(),
        started_at=utc_now(),
        completed_at=utc_now(),
        applied_operations=[ImageOperationStep(operation=OperationType.GRAYSCALE)],
        result=ProcessImageResponse(
            message="done",
            original_image_url="http://test/orig.jpg",
            processed_image_url="http://test/proc.jpg",
            processed_filename="proc.jpg",
            applied_operations=[],
        ),
    )


def test_find_returns_none_for_unknown_job(job_repo: JobRepository) -> None:
    assert job_repo.find("nonexistent") is None


def test_save_and_find_roundtrip(job_repo: JobRepository) -> None:
    job = _queued_job("job-1")
    job_repo.save(job)
    result = job_repo.find("job-1")
    assert result is not None
    assert result.job_id == "job-1"
    assert result.status == JobStatus.QUEUED
    assert result.filename == "test.jpg"
    assert len(result.applied_operations) == 1
    assert result.applied_operations[0].operation == OperationType.GRAYSCALE


def test_save_overwrites_existing_job(job_repo: JobRepository) -> None:
    job_repo.save(_queued_job("job-2"))
    job_repo.save(_running_job("job-2"))
    result = job_repo.find("job-2")
    assert result is not None
    assert result.status == JobStatus.RUNNING


def test_remove_deletes_job(job_repo: JobRepository) -> None:
    job_repo.save(_queued_job("job-3"))
    job_repo.remove("job-3")
    assert job_repo.find("job-3") is None


def test_remove_nonexistent_job_does_not_raise(job_repo: JobRepository) -> None:
    job_repo.remove("nonexistent")


def test_list_recent_returns_jobs_sorted_by_created_at_desc(job_repo: JobRepository) -> None:
    old = ImageProcessJob(
        job_id="old",
        status=JobStatus.QUEUED,
        progress=0,
        message="old",
        filename="old.jpg",
        created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        applied_operations=[],
    )
    new = ImageProcessJob(
        job_id="new",
        status=JobStatus.QUEUED,
        progress=0,
        message="new",
        filename="new.jpg",
        created_at=datetime(2026, 6, 1, tzinfo=timezone.utc),
        applied_operations=[],
    )
    job_repo.save(old)
    job_repo.save(new)
    jobs = job_repo.list_recent(10)
    assert len(jobs) == 2
    assert jobs[0].job_id == "new"
    assert jobs[1].job_id == "old"


def test_list_recent_respects_limit(job_repo: JobRepository) -> None:
    for i in range(5):
        job_repo.save(_queued_job(f"limit-{i}"))
    assert len(job_repo.list_recent(3)) == 3


def test_mark_interrupted_marks_queued_as_failed(job_repo: JobRepository) -> None:
    job_repo.save(_queued_job("q-job"))
    job_repo.mark_interrupted_jobs()
    job = job_repo.find("q-job")
    assert job is not None
    assert job.status == JobStatus.FAILED
    assert job.error_message is not None
    assert job.started_at is not None
    assert job.completed_at is not None


def test_mark_interrupted_preserves_started_at_for_running_job(job_repo: JobRepository) -> None:
    running = _running_job("r-job")
    original_started_at = running.started_at
    job_repo.save(running)
    job_repo.mark_interrupted_jobs()
    job = job_repo.find("r-job")
    assert job is not None
    assert job.status == JobStatus.FAILED
    assert job.started_at == original_started_at


def test_mark_interrupted_leaves_completed_job_unchanged(job_repo: JobRepository) -> None:
    job_repo.save(_completed_job("c-job"))
    job_repo.mark_interrupted_jobs()
    job = job_repo.find("c-job")
    assert job is not None
    assert job.status == JobStatus.COMPLETED


def test_completed_job_roundtrip_preserves_result(job_repo: JobRepository) -> None:
    job_repo.save(_completed_job("c-2"))
    result = job_repo.find("c-2")
    assert result is not None
    assert result.result is not None
    assert result.result.original_image_url == "http://test/orig.jpg"
    assert result.result.processed_image_url == "http://test/proc.jpg"
