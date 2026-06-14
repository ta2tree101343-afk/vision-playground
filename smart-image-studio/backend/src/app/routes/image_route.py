from fastapi import APIRouter, Depends, File, Form, Request, UploadFile, status
from starlette.concurrency import run_in_threadpool

from app.controllers.image_controller import ImageController
from app.dependencies.service_dependency import get_image_controller
from app.schemas.image import ProcessImageResponse
from app.validators.image_validator import read_and_validate_image

router = APIRouter()


@router.post(
    "/process",
    response_model=ProcessImageResponse,
    summary="画像処理",
    description="""\
アップロードされた画像に指定のパイプラインを適用し、加工結果を同期で返します。

`operations` は `ImageOperationStep` の JSON 配列（文字列）です。
""",
    response_description="加工後の画像URL・適用した処理一覧・解析結果を含むレスポンス",
    responses={
        status.HTTP_400_BAD_REQUEST: {
            "description": "ファイル名が不正、ファイルが空、画像として認識できない、または operations のバリデーションエラー"
        },
        status.HTTP_413_CONTENT_TOO_LARGE: {"description": "ファイルサイズが 20 MB を超えているか、画素数が上限を超えています"},
        status.HTTP_500_INTERNAL_SERVER_ERROR: {"description": "画像処理・マスク保存・ファイル保存のいずれかに失敗しました"},
    },
)
async def process_image(
    request: Request,
    file: UploadFile = File(...),
    operations: str = Form(...),
    controller: ImageController = Depends(get_image_controller),
) -> ProcessImageResponse:
    image_bytes = await read_and_validate_image(file)
    return await run_in_threadpool(
        controller.process_image,
        request=request,
        image_bytes=image_bytes,
        filename=file.filename or "upload.png",
        operations=operations,
    )
