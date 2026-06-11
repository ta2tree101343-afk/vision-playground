from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from starlette.concurrency import run_in_threadpool

from app.controllers.image_controller import ImageController
from app.dependencies.service_dependency import get_image_usecase
from app.schemas.image import ProcessImageResponse
from app.usecases.image_usecase import ImageUsecase
from app.validators.image_validator import read_and_validate_image

router = APIRouter()


def _get_controller(image_usecase: ImageUsecase = Depends(get_image_usecase)) -> ImageController:
    return ImageController(image_usecase)


@router.post("/process", response_model=ProcessImageResponse)
async def process_image(
    request: Request,
    file: UploadFile = File(...),
    operations: str = Form(...),
    controller: ImageController = Depends(_get_controller),
) -> ProcessImageResponse:
    image_bytes = await read_and_validate_image(file)
    return await run_in_threadpool(
        controller.process_image,
        request=request,
        image_bytes=image_bytes,
        filename=file.filename or "upload.png",
        operations=operations,
    )
