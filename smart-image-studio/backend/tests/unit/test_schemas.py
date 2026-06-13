from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from app.schemas.image import ImageOperationParameters, ImageOperationStep, OperationType
from app.schemas.job import ImageProcessJob, JobStatus


def test_even_blur_strength_raises_validation_error() -> None:
    with pytest.raises(ValidationError):
        ImageOperationParameters(blur_strength=4)


def test_odd_blur_strength_is_valid() -> None:
    params = ImageOperationParameters(blur_strength=5)
    assert params.blur_strength == 5


def test_none_blur_strength_is_valid() -> None:
    params = ImageOperationParameters(blur_strength=None)
    assert params.blur_strength is None


def test_grayscale_with_brightness_raises_validation_error() -> None:
    with pytest.raises(ValidationError):
        ImageOperationStep(
            operation=OperationType.GRAYSCALE,
            parameters=ImageOperationParameters(brightness=10),
        )


def test_grayscale_with_no_parameters_is_valid() -> None:
    step = ImageOperationStep(operation=OperationType.GRAYSCALE)
    assert step.operation == OperationType.GRAYSCALE
    assert step.parameters.brightness is None


def test_blur_with_valid_parameters_is_valid() -> None:
    step = ImageOperationStep(
        operation=OperationType.BLUR,
        parameters=ImageOperationParameters(blur_strength=5, blur_sigma=1.0),
    )
    assert step.parameters.blur_strength == 5


def test_blur_with_unsupported_parameter_raises_validation_error() -> None:
    with pytest.raises(ValidationError):
        ImageOperationStep(
            operation=OperationType.BLUR,
            parameters=ImageOperationParameters(brightness=10),
        )


def test_object_detection_with_threshold_is_valid() -> None:
    step = ImageOperationStep(
        operation=OperationType.OBJECT_DETECTION,
        parameters=ImageOperationParameters(detection_threshold=0.45),
    )
    assert step.parameters.detection_threshold == 0.45


# ── ImageProcessJob validator ──────────────────────────────────────────────────

_NOW = datetime(2025, 1, 1, tzinfo=timezone.utc)
_LATER = datetime(2025, 1, 1, 1, tzinfo=timezone.utc)


def _base_job(**overrides: object) -> dict:
    return {
        "job_id": "test-job",
        "status": JobStatus.QUEUED,
        "progress": 0,
        "message": "",
        "filename": "test.png",
        "created_at": _NOW,
        "applied_operations": [],
        **overrides,
    }


def test_completed_job_requires_result() -> None:
    with pytest.raises(ValidationError):
        ImageProcessJob(**_base_job(status=JobStatus.COMPLETED, started_at=_NOW, completed_at=_LATER))


def test_completed_job_with_result_is_valid() -> None:
    from app.schemas.image import ProcessImageResponse
    result = ProcessImageResponse(
        message="ok", original_image_url="/o", processed_image_url="/p",
        processed_filename="out.png", applied_operations=[],
    )
    job = ImageProcessJob(**_base_job(
        status=JobStatus.COMPLETED, started_at=_NOW, completed_at=_LATER, result=result,
    ))
    assert job.status == JobStatus.COMPLETED


def test_non_completed_job_rejects_result() -> None:
    from app.schemas.image import ProcessImageResponse
    result = ProcessImageResponse(
        message="ok", original_image_url="/o", processed_image_url="/p",
        processed_filename="out.png", applied_operations=[],
    )
    with pytest.raises(ValidationError):
        ImageProcessJob(**_base_job(status=JobStatus.QUEUED, result=result))


def test_failed_job_requires_error_message() -> None:
    with pytest.raises(ValidationError):
        ImageProcessJob(**_base_job(
            status=JobStatus.FAILED, started_at=_NOW, completed_at=_LATER,
        ))


def test_non_failed_job_rejects_error_message() -> None:
    with pytest.raises(ValidationError):
        ImageProcessJob(**_base_job(status=JobStatus.QUEUED, error_message="oops"))


def test_unknown_parameter_field_raises_validation_error() -> None:
    with pytest.raises(ValidationError):
        ImageOperationParameters(unknown_field=1)


def test_unknown_step_field_raises_validation_error() -> None:
    with pytest.raises(ValidationError):
        ImageOperationStep(operation=OperationType.GRAYSCALE, unknown_field="x")


def test_job_response_discriminated_union_queued() -> None:
    from app.schemas.job_response import ImageProcessJobResponse
    from pydantic import TypeAdapter
    adapter = TypeAdapter(ImageProcessJobResponse)
    job = adapter.validate_python({
        "job_id": "x", "status": "queued", "progress": 0,
        "message": "", "filename": "f.png", "created_at": _NOW,
        "applied_operations": [],
    })
    assert job.status == "queued"


def test_job_response_discriminated_union_completed() -> None:
    from app.schemas.image import ProcessImageResponse
    from app.schemas.job_response import ImageProcessJobResponse
    from pydantic import TypeAdapter
    adapter = TypeAdapter(ImageProcessJobResponse)
    result = ProcessImageResponse(
        message="ok", original_image_url="/o", processed_image_url="/p",
        processed_filename="out.png", applied_operations=[],
    )
    job = adapter.validate_python({
        "job_id": "x", "status": "completed", "progress": 100,
        "message": "", "filename": "f.png", "created_at": _NOW,
        "started_at": _NOW, "completed_at": _LATER,
        "applied_operations": [], "result": result.model_dump(mode="json"),
    })
    assert job.status == "completed"
    assert job.result.message == "ok"


def test_job_response_discriminated_union_failed() -> None:
    from app.schemas.job_response import ImageProcessJobResponse
    from pydantic import TypeAdapter
    adapter = TypeAdapter(ImageProcessJobResponse)
    job = adapter.validate_python({
        "job_id": "x", "status": "failed", "progress": 0,
        "message": "", "filename": "f.png", "created_at": _NOW,
        "started_at": _NOW, "completed_at": _LATER,
        "applied_operations": [], "error_message": "something went wrong",
    })
    assert job.status == "failed"
    assert job.error_message == "something went wrong"


def test_completed_job_response_requires_result() -> None:
    from app.schemas.job_response import ImageProcessJobResponse
    from pydantic import TypeAdapter, ValidationError
    adapter = TypeAdapter(ImageProcessJobResponse)
    with pytest.raises(ValidationError):
        adapter.validate_python({
            "job_id": "x", "status": "completed", "progress": 100,
            "message": "", "filename": "f.png", "created_at": _NOW,
            "started_at": _NOW, "completed_at": _LATER,
            "applied_operations": [],
        })
