from fastapi import APIRouter

from app.schemas.image import HealthCheckResponse

router = APIRouter()


@router.get("/health", response_model=HealthCheckResponse)
def health_check() -> HealthCheckResponse:
    return HealthCheckResponse(status="ok")

