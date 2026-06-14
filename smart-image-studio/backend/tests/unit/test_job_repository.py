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


# --- update() tests ---

def test_update_status_and_progress(job_repo: JobRepository) -> None:
    job_repo.save(_queued_job("u-1"))
    job_repo.update("u-1", status=JobStatus.RUNNING, progress=50, message="running now")
    job = job_repo.find("u-1")
    assert job is not None
    assert job.status == JobStatus.RUNNING
    assert job.progress == 50
    assert job.message == "running now"


def test_update_sets_started_at_only_when_not_already_set(job_repo: JobRepository) -> None:
    running = _running_job("u-2")
    original_started_at = running.started_at
    job_repo.save(running)
    job_repo.update("u-2", started_at=utc_now())
    job = job_repo.find("u-2")
    assert job is not None
    assert job.started_at == original_started_at


def test_update_sets_started_at_when_not_yet_set(job_repo: JobRepository) -> None:
    job_repo.save(_queued_job("u-3"))
    t = utc_now()
    job_repo.update("u-3", started_at=t)
    job = job_repo.find("u-3")
    assert job is not None
    assert job.started_at == t


def test_update_result_and_clears_error_on_completed(job_repo: JobRepository) -> None:
    from app.schemas.image import ProcessImageResponse
    job_repo.save(_queued_job("u-4"))
    res = ProcessImageResponse(
        message="done",
        original_image_url="http://test/orig.jpg",
        processed_image_url="http://test/proc.jpg",
        processed_filename="proc.jpg",
        applied_operations=[],
    )
    job_repo.update("u-4", status=JobStatus.COMPLETED, result=res, error_message=None)
    job = job_repo.find("u-4")
    assert job is not None
    assert job.status == JobStatus.COMPLETED
    assert job.result is not None
    assert job.result.original_image_url == "http://test/orig.jpg"
    assert job.error_message is None


def test_update_error_message_on_failed(job_repo: JobRepository) -> None:
    job_repo.save(_queued_job("u-5"))
    job_repo.update("u-5", status=JobStatus.FAILED, error_message="something went wrong")
    job = job_repo.find("u-5")
    assert job is not None
    assert job.status == JobStatus.FAILED
    assert job.error_message == "something went wrong"


def test_update_nonexistent_job_does_not_raise(job_repo: JobRepository) -> None:
    job_repo.update("nonexistent", status=JobStatus.FAILED, error_message="nope")
