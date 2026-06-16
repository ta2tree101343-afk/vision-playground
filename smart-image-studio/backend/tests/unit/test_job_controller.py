from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from app.controllers.job_controller import JobController
from app.core.exceptions import JobNotFoundError, JobQueueFullError
from app.services.job_service import JobService

_VALID_OPS = '[{"operation":"grayscale"}]'
_INVALID_OPS = "not-json"


@pytest.fixture
def job_svc() -> MagicMock:
    svc = MagicMock(spec=JobService)
    svc.enqueue_job = AsyncMock()
    return svc


@pytest.fixture
def controller(job_svc: MagicMock) -> JobController:
    return JobController(job_svc)


@pytest.fixture(autouse=True)
def _patch_settings():
    with patch("app.controllers.job_controller.get_settings") as mock:
        mock.return_value.public_base_url = "http://test:8000"
        yield


# --- create_job ---

async def test_create_job_queue_full_raises_503(controller: JobController, job_svc: MagicMock) -> None:
    job_svc.enqueue_job.side_effect = JobQueueFullError()

    with pytest.raises(HTTPException) as exc_info:
        await controller.create_job(image_bytes=b"x", filename="photo.png", operations=_VALID_OPS)

    assert exc_info.value.status_code == 503


def test_create_job_invalid_operations_json_raises_400(controller: JobController) -> None:
    # parse_operation_steps が HTTPException(400) を raise し、controller はそのまま素通りさせる
    with pytest.raises(HTTPException) as exc_info:
        import asyncio
        asyncio.get_event_loop().run_until_complete(
            controller.create_job(image_bytes=b"x", filename="photo.png", operations=_INVALID_OPS)
        )
    assert exc_info.value.status_code == 400


async def test_create_job_returns_job_on_success(controller: JobController, job_svc: MagicMock) -> None:
    job_svc.enqueue_job.return_value = MagicMock()

    result = await controller.create_job(image_bytes=b"x", filename="photo.png", operations=_VALID_OPS)

    assert result is job_svc.enqueue_job.return_value


async def test_create_job_passes_base_url_from_settings(controller: JobController, job_svc: MagicMock) -> None:
    job_svc.enqueue_job.return_value = MagicMock()

    await controller.create_job(image_bytes=b"x", filename="photo.png", operations=_VALID_OPS)

    _, kwargs = job_svc.enqueue_job.call_args
    assert kwargs["base_url"] == "http://test:8000"


# --- get_job ---

def test_get_job_not_found_raises_404(controller: JobController, job_svc: MagicMock) -> None:
    job_svc.get_job.side_effect = JobNotFoundError("unknown-id")

    with pytest.raises(HTTPException) as exc_info:
        controller.get_job("unknown-id")

    assert exc_info.value.status_code == 404


def test_get_job_returns_job_on_success(controller: JobController, job_svc: MagicMock) -> None:
    job_svc.get_job.return_value = MagicMock()

    result = controller.get_job("some-id")

    assert result is job_svc.get_job.return_value


# --- list_jobs ---

def test_list_jobs_delegates_to_service(controller: JobController, job_svc: MagicMock) -> None:
    job_svc.list_jobs.return_value = []

    result = controller.list_jobs()

    job_svc.list_jobs.assert_called_once()
    assert result == []
