from datetime import datetime
from typing import Annotated, Literal, Union

from pydantic import BaseModel, Field

from app.schemas.image import ImageOperationStep, ProcessImageResponse


class _JobBase(BaseModel):
    job_id: str
    progress: int = Field(ge=0, le=100)
    message: str
    filename: str
    created_at: datetime
    applied_operations: list[ImageOperationStep]


class QueuedJobResponse(_JobBase):
    status: Literal["queued"]
    queue_position: int | None = Field(default=None, ge=1)
    started_at: None = None
    completed_at: None = None
    result: None = None
    error_message: None = None


class RunningJobResponse(_JobBase):
    status: Literal["running"]
    started_at: datetime
    queue_position: None = None
    completed_at: None = None
    result: None = None
    error_message: None = None


class CompletedJobResponse(_JobBase):
    status: Literal["completed"]
    started_at: datetime
    completed_at: datetime
    result: ProcessImageResponse
    queue_position: None = None
    error_message: None = None


class FailedJobResponse(_JobBase):
    status: Literal["failed"]
    started_at: datetime
    completed_at: datetime
    error_message: str
    queue_position: None = None
    result: None = None


ImageProcessJobResponse = Annotated[
    Union[QueuedJobResponse, RunningJobResponse, CompletedJobResponse, FailedJobResponse],
    Field(discriminator="status"),
]
