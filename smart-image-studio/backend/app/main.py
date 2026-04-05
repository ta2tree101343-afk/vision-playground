from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.router import api_router
from app.api.routes.images import job_service
from app.core.config import get_settings

settings = get_settings()
settings.upload_path.mkdir(parents=True, exist_ok=True)

app = FastAPI(
    title=settings.app_name,
    debug=settings.debug,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
app.mount("/uploads", StaticFiles(directory=settings.upload_path), name="uploads")


@app.on_event("shutdown")
async def shutdown_event() -> None:
    await job_service.shutdown()
