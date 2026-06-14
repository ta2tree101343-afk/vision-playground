from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field, model_validator

from app.schemas.image import ImageOperationStep, ProcessImageResponse


class JobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class ImageProcessJob(BaseModel):
    job_id: str
    status: JobStatus
    progress: int = Field(ge=0, le=100)
    message: str
    filename: str
    queue_position: int | None = Field(default=None, ge=1)
    created_at: datetime
    started_at: datetime | None = None
    completed_at: datetime | None = None
    applied_operations: list[ImageOperationStep]
    result: ProcessImageResponse | None = None
    error_message: str | None = None

    @model_validator(mode="after")
    def validate_status_fields(self) -> "ImageProcessJob":
        if self.status == JobStatus.COMPLETED:
            if self.result is None:
                raise ValueError("completed ジョブには result が必要です")
            if self.started_at is None or self.completed_at is None:
                raise ValueError("completed ジョブには started_at と completed_at が必要です")
        else:
            if self.result is not None:
                raise ValueError("result は completed 状態以外では null である必要があります")

        if self.status == JobStatus.FAILED:
            if self.error_message is None:
                raise ValueError("failed ジョブには error_message が必要です")
            if self.completed_at is None:
                raise ValueError("failed ジョブには completed_at が必要です")
        else:
            if self.error_message is not None:
                raise ValueError("error_message は failed 状態以外では null である必要があります")

        if self.status == JobStatus.RUNNING:
            if self.started_at is None:
                raise ValueError("running ジョブには started_at が必要です")

        return self
