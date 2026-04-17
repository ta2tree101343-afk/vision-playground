from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field, model_validator


class OperationType(str, Enum):
    GRAYSCALE = "grayscale"
    BLUR = "blur"
    SHARPEN = "sharpen"
    DENOISE = "denoise"
    EDGE_DETECTION = "edge_detection"
    BRIGHTNESS = "brightness"
    CONTRAST = "contrast"
    BACKGROUND_REMOVAL = "background_removal"
    OCR = "ocr"
    OBJECT_DETECTION = "object_detection"
    CAPTION_GENERATION = "caption_generation"


class JobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class ImageOperationParameters(BaseModel):
    blur_strength: int | None = Field(default=None, ge=1, le=25)
    blur_sigma: float | None = Field(default=None, ge=0.0, le=10.0)
    brightness: int | None = Field(default=None, ge=-100, le=100)
    contrast: int | None = Field(default=None, ge=-100, le=100)
    sharpen_strength: int | None = Field(default=None, ge=1, le=5)
    denoise_strength: int | None = Field(default=None, ge=1, le=30)
    detection_threshold: float | None = Field(default=None, ge=0.1, le=0.95)


class ImageOperationStep(BaseModel):
    operation: OperationType
    parameters: ImageOperationParameters = Field(
        default_factory=ImageOperationParameters
    )

    @model_validator(mode="after")
    def validate_supported_parameters(self) -> "ImageOperationStep":
        parameter_map: dict[OperationType, list[str]] = {
            OperationType.BLUR: ["blur_strength", "blur_sigma"],
            OperationType.SHARPEN: ["sharpen_strength"],
            OperationType.DENOISE: ["denoise_strength"],
            OperationType.BRIGHTNESS: ["brightness"],
            OperationType.CONTRAST: ["contrast"],
            OperationType.OBJECT_DETECTION: ["detection_threshold"],
        }
        allowed_keys = set(parameter_map.get(self.operation, []))
        for field_name in self.parameters.model_dump(exclude_none=True):
            if field_name not in allowed_keys:
                raise ValueError(
                    f"{self.operation.value} では {field_name} パラメータは使用できません。"
                )
        return self


class BoundingBox(BaseModel):
    x: int = Field(ge=0)
    y: int = Field(ge=0)
    width: int = Field(ge=0)
    height: int = Field(ge=0)


class OcrLine(BaseModel):
    text: str
    confidence: float = Field(ge=0.0, le=1.0)
    bounding_box: BoundingBox


class OcrResult(BaseModel):
    full_text: str
    lines: list[OcrLine] = Field(default_factory=list)


class DetectedObject(BaseModel):
    label: str
    confidence: float = Field(ge=0.0, le=1.0)
    bounding_box: BoundingBox


class ObjectDetectionResult(BaseModel):
    model: str
    threshold: float = Field(ge=0.0, le=1.0)
    detections: list[DetectedObject] = Field(default_factory=list)


class BackgroundRemovalResult(BaseModel):
    foreground_ratio: float = Field(ge=0.0, le=1.0)
    mask_image_url: str | None = None


class CaptionCandidate(BaseModel):
    text: str
    score: float = Field(ge=0.0, le=1.0)


class CaptionResult(BaseModel):
    candidates: list[CaptionCandidate] = Field(default_factory=list)


class ImageAnalysisResult(BaseModel):
    background_removal: BackgroundRemovalResult | None = None
    ocr: OcrResult | None = None
    object_detection: ObjectDetectionResult | None = None
    captions: CaptionResult | None = None


class ProcessImageResponse(BaseModel):
    message: str
    original_image_url: str
    processed_image_url: str
    processed_filename: str
    applied_operations: list[ImageOperationStep]
    analysis: ImageAnalysisResult | None = None


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


class HealthCheckResponse(BaseModel):
    status: str
