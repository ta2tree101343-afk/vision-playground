from fastapi import APIRouter

from app.routes.health_route import router as health_router
from app.routes.image_route import router as image_router
from app.routes.job_route import router as job_route

api_router = APIRouter()
api_router.include_router(health_router, tags=["health"])
api_router.include_router(image_router, prefix="/api/images", tags=["images"])
api_router.include_router(job_route, prefix="/api/images", tags=["jobs"])
