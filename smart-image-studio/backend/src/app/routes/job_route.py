from fastapi import APIRouter, Depends, File, Form, Request, UploadFile, status

from app.controllers.job_controller import JobController
from app.dependencies.service_dependency import get_job_service
from app.schemas.job import ImageProcessJob
from app.services.job_service import JobService
from app.validators.image_validator import read_and_validate_image

router = APIRouter()


def _get_controller(job_service: JobService = Depends(get_job_service)) -> JobController:
    return JobController(job_service)


@router.post("/jobs", response_model=ImageProcessJob, status_code=status.HTTP_202_ACCEPTED)
async def create_process_job(
    request: Request,
    file: UploadFile = File(...),
    operations: str = Form(...),
    controller: JobController = Depends(_get_controller),
) -> ImageProcessJob:
    image_bytes = await read_and_validate_image(file)
    return await controller.create_job(
        request=request,
        image_bytes=image_bytes,
        filename=file.filename or "upload.png",
        operations=operations,
    )


@router.get("/jobs", response_model=list[ImageProcessJob])
def list_process_jobs(controller: JobController = Depends(_get_controller)) -> list[ImageProcessJob]:
    return controller.list_jobs()


@router.get("/jobs/{job_id}", response_model=ImageProcessJob)
def get_process_job(job_id: str, controller: JobController = Depends(_get_controller)) -> ImageProcessJob:
    return controller.get_job(job_id)
