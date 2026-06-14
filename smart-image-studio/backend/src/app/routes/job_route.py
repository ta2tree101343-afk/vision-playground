from fastapi import APIRouter, Depends, File, Form, Request, UploadFile, status

from app.controllers.job_controller import JobController
from app.dependencies.service_dependency import get_job_controller
from app.schemas.job import ImageProcessJob
from app.schemas.job_response import ImageProcessJobResponse
from app.validators.image_validator import read_and_validate_image

router = APIRouter()


@router.post(
    "/jobs",
    response_model=ImageProcessJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="ジョブを作成",
    description="""\
画像処理ジョブをキューに登録し、非同期で処理を開始します。

ジョブ ID を使って `GET /jobs/{job_id}` でステータスをポーリングしてください。
""",
    response_description="作成されたジョブの初期状態（status: queued）",
    responses={
        status.HTTP_400_BAD_REQUEST: {
            "description": "ファイル名が不正、ファイルが空、画像として認識できない、または operations のバリデーションエラー"
        },
        status.HTTP_413_CONTENT_TOO_LARGE: {"description": "ファイルサイズが 20 MB を超えているか、画素数が上限を超えています"},
        status.HTTP_503_SERVICE_UNAVAILABLE: {"description": "ジョブキューが満杯です。しばらく後に再試行してください"},
    },
)
async def create_process_job(
    request: Request,
    file: UploadFile = File(...),
    operations: str = Form(...),
    controller: JobController = Depends(get_job_controller),
) -> ImageProcessJob:  # FastAPI serializes via response_model=ImageProcessJobResponse
    image_bytes = await read_and_validate_image(file)
    return await controller.create_job(
        request=request,
        image_bytes=image_bytes,
        filename=file.filename or "upload.png",
        operations=operations,
    )


@router.get(
    "/jobs",
    response_model=list[ImageProcessJobResponse],
    summary="ジョブ一覧を取得",
    description="最近のジョブを作成日時の降順で返します。",
    response_description="ジョブの一覧（新しい順）",
    responses={},
)
def list_process_jobs(controller: JobController = Depends(get_job_controller)) -> list[ImageProcessJob]:  # FastAPI serializes via response_model=list[ImageProcessJobResponse]
    return controller.list_jobs()


@router.get(
    "/jobs/{job_id}",
    response_model=ImageProcessJobResponse,
    summary="ジョブを取得",
    description="指定した `job_id` のジョブ詳細を返します。",
    response_description="指定ジョブの現在の状態",
    responses={
        status.HTTP_404_NOT_FOUND: {"description": "指定されたジョブが見つかりません"},
    },
)
def get_process_job(job_id: str, controller: JobController = Depends(get_job_controller)) -> ImageProcessJob:  # FastAPI serializes via response_model=ImageProcessJobResponse
    return controller.get_job(job_id)
