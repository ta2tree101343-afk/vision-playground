import json
import logging
from json import JSONDecodeError

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile, status
from pydantic import ValidationError

from app.core.config import get_settings
from app.schemas.image import (
    ImageOperationParameters,
    ImageOperationStep,
    ImageProcessJob,
    OperationType,
    ProcessImageResponse,
)
from app.schemas.pipeline import PipelinePlan
from app.services.image_processor import ImageProcessingError, ImageProcessor
from app.services.job_service import ImageJobService, build_asset_url
from app.services.storage_service import (
    LocalImageStorage,
    MaskSaveError,
    attach_analysis_assets,
)
from app.utils.image_validation import read_and_validate_image

router = APIRouter()
logger = logging.getLogger(__name__)

settings = get_settings()
storage_service = LocalImageStorage(settings.upload_path)
image_processor = ImageProcessor()
job_service = ImageJobService(
    image_processor=image_processor,
    storage_service=storage_service,
    history_path=settings.upload_path / "jobs" / "history.json",
)


def build_operation_steps(
    operations: str | None,
    operation: OperationType | None,
    blur_strength: int | None,
    brightness: int | None,
    contrast: int | None,
    sharpen_strength: int | None,
    denoise_strength: int | None,
    detection_threshold: float | None,
) -> list[ImageOperationStep]:
    if operations:
        try:
            raw_operations = json.loads(operations)
        except JSONDecodeError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="operations フィールドは JSON 配列で指定してください。",
            ) from exc

        if not isinstance(raw_operations, list) or len(raw_operations) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="operations には 1 件以上の処理を指定してください。",
            )

        try:
            return [ImageOperationStep.model_validate(item) for item in raw_operations]
        except ValidationError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=exc.errors(include_url=False),
            ) from exc

    if operation is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="operation を指定してください。",
        )

    try:
        parameters = ImageOperationParameters(
            blur_strength=blur_strength,
            brightness=brightness,
            contrast=contrast,
            sharpen_strength=sharpen_strength,
            denoise_strength=denoise_strength,
            detection_threshold=detection_threshold,
        )
    except ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=exc.errors(include_url=False),
        ) from exc

    return [ImageOperationStep(operation=operation, parameters=parameters)]


def execute_processing(
    *,
    request: Request,
    image_bytes: bytes,
    filename: str,
    steps: list[ImageOperationStep],
) -> ProcessImageResponse:
    try:
        original_file = storage_service.save_original(image_bytes, filename)
        processing_result = image_processor.process(image_bytes, steps)
        processed_file = storage_service.save_processed(processing_result.image, filename)
        analysis = attach_analysis_assets(
            storage_service,
            analysis=processing_result.analysis,
            background_mask=processing_result.background_mask,
            filename=filename,
            base_url=str(request.base_url),
        )
    except ImageProcessingError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"画像処理に失敗しました: {exc}",
        ) from exc
    except MaskSaveError as exc:
        logger.error("背景マスクの保存に失敗しました: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"背景マスクの保存に失敗しました: {exc}",
        ) from exc
    except OSError as exc:
        logger.error("画像ファイルの保存に失敗しました: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="画像ファイルの保存に失敗しました。",
        ) from exc

    return ProcessImageResponse(
        message="画像処理が完了しました。",
        original_image_url=build_asset_url(str(request.base_url), original_file.public_path),
        processed_image_url=build_asset_url(str(request.base_url), processed_file.public_path),
        processed_filename=processed_file.filename,
        applied_operations=steps,
        analysis=analysis,
    )


@router.post("/process", response_model=ProcessImageResponse)
async def process_image(
    request: Request,
    file: UploadFile = File(...),
    operations: str | None = Form(default=None),
    operation: OperationType | None = Form(default=None),
    blur_strength: int | None = Form(default=None),
    brightness: int | None = Form(default=None),
    contrast: int | None = Form(default=None),
    sharpen_strength: int | None = Form(default=None),
    denoise_strength: int | None = Form(default=None),
    detection_threshold: float | None = Form(default=None),
) -> ProcessImageResponse:
    image_bytes = await read_and_validate_image(file)
    steps = build_operation_steps(
        operations=operations,
        operation=operation,
        blur_strength=blur_strength,
        brightness=brightness,
        contrast=contrast,
        sharpen_strength=sharpen_strength,
        denoise_strength=denoise_strength,
        detection_threshold=detection_threshold,
    )
    filename = file.filename or "upload.png"

    return execute_processing(
        request=request,
        image_bytes=image_bytes,
        filename=filename,
        steps=steps,
    )


@router.post("/jobs", response_model=ImageProcessJob, status_code=status.HTTP_202_ACCEPTED)
async def create_process_job(
    request: Request,
    file: UploadFile = File(...),
    operations: str | None = Form(default=None),
    operation: OperationType | None = Form(default=None),
    blur_strength: int | None = Form(default=None),
    brightness: int | None = Form(default=None),
    contrast: int | None = Form(default=None),
    sharpen_strength: int | None = Form(default=None),
    denoise_strength: int | None = Form(default=None),
    detection_threshold: float | None = Form(default=None),
) -> ImageProcessJob:
    image_bytes = await read_and_validate_image(file)
    steps = build_operation_steps(
        operations=operations,
        operation=operation,
        blur_strength=blur_strength,
        brightness=brightness,
        contrast=contrast,
        sharpen_strength=sharpen_strength,
        denoise_strength=denoise_strength,
        detection_threshold=detection_threshold,
    )
    filename = file.filename or "upload.png"

    return await job_service.enqueue_job(
        image_bytes=image_bytes,
        filename=filename,
        base_url=str(request.base_url),
        operations=steps,
    )


@router.get("/jobs", response_model=list[ImageProcessJob])
def list_process_jobs() -> list[ImageProcessJob]:
    return job_service.list_jobs()


@router.get("/jobs/{job_id}", response_model=ImageProcessJob)
def get_process_job(job_id: str) -> ImageProcessJob:
    return job_service.get_job(job_id)


@router.post("/process-pipeline", response_model=ProcessImageResponse)
async def process_image_pipeline(
    request: Request,
    file: UploadFile = File(...),
    plan: str = Form(...),
) -> ProcessImageResponse:
    image_bytes = await read_and_validate_image(file)
    filename = file.filename or "upload.png"

    try:
        pipeline_plan = PipelinePlan.model_validate_json(plan)
    except ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=exc.errors(include_url=False),
        ) from exc

    if len(pipeline_plan.steps) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="PipelinePlan に 1 件以上の step が必要です。",
        )

    steps = pipeline_plan.steps
    return execute_processing(
        request=request,
        image_bytes=image_bytes,
        filename=filename,
        steps=steps,
    )
