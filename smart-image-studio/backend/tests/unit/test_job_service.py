from __future__ import annotations

import asyncio
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from PIL import Image

from app.core.exceptions import ImageProcessingError, JobNotFoundError, MaskSaveError
from app.infrastructure.storage.local_storage import StoredImage
from app.repositories.job_repository import JobRepository
from app.schemas.image import ImageOperationStep, OperationType
from app.schemas.job import JobStatus
from app.services.image_processor import ImageProcessor, ImageProcessingResult
from app.services.job_service import JobService
from app.services.storage_service import StorageService
from conftest import make_png_bytes


def _make_service(job_repo: "JobRepository") -> tuple[JobService, MagicMock, MagicMock]:
    image_processor = MagicMock(spec=ImageProcessor)
    storage_service = MagicMock(spec=StorageService)
    svc = JobService(image_processor, storage_service, job_repo)
    return svc, image_processor, storage_service


def _stored(tmp_path: Path, name: str = "test.png", public: str = "/uploads/originals/test.png") -> StoredImage:
    p = tmp_path / name
    p.write_bytes(make_png_bytes(4, 4))
    return StoredImage(filename=name, public_path=public, file_path=p)


def _ops() -> list[ImageOperationStep]:
    return [ImageOperationStep(operation=OperationType.GRAYSCALE)]


def test_get_job_raises_not_found_for_unknown_id(job_repo: JobRepository) -> None:
    svc, _, _ = _make_service(job_repo)
    with pytest.raises(JobNotFoundError):
        svc.get_job("nonexistent")


def test_list_jobs_returns_empty_initially(job_repo: JobRepository) -> None:
    svc, _, _ = _make_service(job_repo)
    assert svc.list_jobs() == []


async def test_process_job_marks_failed_on_image_processing_error(tmp_path: Path, job_repo: JobRepository) -> None:
    svc, image_processor, storage_service = _make_service(job_repo)
    storage_service.save_original.return_value = _stored(tmp_path)
    image_processor.process.side_effect = ImageProcessingError("bad image")

    job = await svc.enqueue_job(image_bytes=make_png_bytes(4, 4), filename="test.png", base_url="http://localhost:8000/", operations=_ops())
    await asyncio.sleep(0.1)

    result = svc.get_job(job.job_id)
    assert result.status == JobStatus.FAILED
    assert result.error_message is not None
    assert "画像処理に失敗しました" in result.error_message

    await svc.shutdown()


async def test_process_job_marks_failed_on_mask_save_error(tmp_path: Path, job_repo: JobRepository) -> None:
    svc, image_processor, storage_service = _make_service(job_repo)
    storage_service.save_original.return_value = _stored(tmp_path)

    img = Image.new("RGB", (4, 4))
    image_processor.process.return_value = ImageProcessingResult(image=img)
    storage_service.save_processed.return_value = _stored(tmp_path, "proc.png", "/uploads/processed/proc.png")

    with patch("app.services.storage_service.attach_analysis_assets", side_effect=MaskSaveError("disk full")):
        job = await svc.enqueue_job(image_bytes=make_png_bytes(4, 4), filename="test.png", base_url="http://localhost:8000/", operations=_ops())
        await asyncio.sleep(0.1)

    result = svc.get_job(job.job_id)
    assert result.status == JobStatus.FAILED
    assert result.error_message is not None
    assert "背景マスク" in result.error_message

    await svc.shutdown()


async def test_process_job_marks_failed_on_os_error(tmp_path: Path, job_repo: JobRepository) -> None:
    svc, image_processor, storage_service = _make_service(job_repo)
    storage_service.save_original.return_value = _stored(tmp_path)

    img = Image.new("RGB", (4, 4))
    image_processor.process.return_value = ImageProcessingResult(image=img)
    storage_service.save_processed.side_effect = OSError("disk full")

    job = await svc.enqueue_job(image_bytes=make_png_bytes(4, 4), filename="test.png", base_url="http://localhost:8000/", operations=_ops())
    await asyncio.sleep(0.1)

    result = svc.get_job(job.job_id)
    assert result.status == JobStatus.FAILED
    assert result.error_message is not None

    await svc.shutdown()


async def test_process_job_marks_failed_on_unexpected_exception(tmp_path: Path, job_repo: JobRepository) -> None:
    svc, image_processor, storage_service = _make_service(job_repo)
    storage_service.save_original.return_value = _stored(tmp_path)
    image_processor.process.side_effect = ValueError("totally unexpected")

    job = await svc.enqueue_job(image_bytes=make_png_bytes(4, 4), filename="test.png", base_url="http://localhost:8000/", operations=_ops())
    await asyncio.sleep(0.1)

    result = svc.get_job(job.job_id)
    assert result.status == JobStatus.FAILED
    assert result.error_message is not None

    await svc.shutdown()


async def test_enqueue_job_removes_from_repo_when_queue_full(tmp_path: Path, job_repo: JobRepository) -> None:
    svc, _, storage_service = _make_service(job_repo)
    storage_service.save_original.return_value = _stored(tmp_path)

    with patch.object(svc._task_queue, "enqueue_nowait", side_effect=asyncio.QueueFull):
        from app.core.exceptions import JobQueueFullError
        with pytest.raises(JobQueueFullError):
            await svc.enqueue_job(image_bytes=make_png_bytes(4, 4), filename="test.png", base_url="http://localhost:8000/", operations=_ops())

    assert svc.list_jobs() == []


async def test_process_job_completes_successfully(tmp_path: Path, job_repo: JobRepository) -> None:
    svc, image_processor, storage_service = _make_service(job_repo)
    storage_service.save_original.return_value = _stored(tmp_path)

    img = Image.new("RGB", (4, 4))
    image_processor.process.return_value = ImageProcessingResult(image=img)
    storage_service.save_processed.return_value = _stored(tmp_path, "proc.png", "/uploads/processed/proc.png")

    with patch("app.services.storage_service.attach_analysis_assets", return_value=None):
        job = await svc.enqueue_job(image_bytes=make_png_bytes(4, 4), filename="test.png", base_url="http://localhost:8000/", operations=_ops())
        await asyncio.sleep(0.1)

    result = svc.get_job(job.job_id)
    assert result.status == JobStatus.COMPLETED
    assert result.result is not None
    assert result.error_message is None
    assert result.completed_at is not None

    await svc.shutdown()


async def test_queue_position_is_set_for_queued_jobs(tmp_path: Path, job_repo: JobRepository) -> None:
    svc, _, storage_service = _make_service(job_repo)

    slow_event = asyncio.Event()

    async def slow_process(job_id: str) -> None:
        await slow_event.wait()

    with patch.object(svc._task_queue, "_worker_loop", slow_process):
        storage_service.save_original.return_value = _stored(tmp_path)
        job = await svc.enqueue_job(image_bytes=make_png_bytes(4, 4), filename="test.png", base_url="http://localhost:8000/", operations=_ops())

    listed = svc.get_job(job.job_id)
    assert listed.queue_position == 1
