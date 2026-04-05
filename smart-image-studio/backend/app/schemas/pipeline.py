from enum import Enum

from pydantic import BaseModel, Field, model_validator


class PipelineOperationType(str, Enum):
    GRAYSCALE = "grayscale"
    BLUR = "blur"
    SHARPEN = "sharpen"
    DENOISE = "denoise"
    EDGE_DETECTION = "edge_detection"
    CONTRAST = "contrast"
    BACKGROUND_REMOVAL = "background_removal"
    OBJECT_DETECTION = "object_detection"
    CAPTION_GENERATION = "caption_generation"
    BRIGHTNESS = "brightness"


class PipelineInterpreterMode(str, Enum):
    RULE_BASED = "rule_based"
    LLM = "llm"


class PipelinePlanConfidence(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class PipelineStepParameters(BaseModel):
    blur_strength: int | None = Field(default=None, ge=1, le=25)
    brightness: int | None = Field(default=None, ge=-100, le=100)
    contrast: int | None = Field(default=None, ge=-100, le=100)
    sharpen_strength: int | None = Field(default=None, ge=1, le=5)
    denoise_strength: int | None = Field(default=None, ge=1, le=30)
    detection_threshold: float | None = Field(default=None, ge=0.1, le=0.95)


class PipelineStep(BaseModel):
    operation: PipelineOperationType
    parameters: PipelineStepParameters = Field(default_factory=PipelineStepParameters)

    @model_validator(mode="after")
    def validate_supported_parameters(self) -> "PipelineStep":
        parameter_map = {
            PipelineOperationType.BLUR: ["blur_strength"],
            PipelineOperationType.SHARPEN: ["sharpen_strength"],
            PipelineOperationType.DENOISE: ["denoise_strength"],
            PipelineOperationType.BRIGHTNESS: ["brightness"],
            PipelineOperationType.CONTRAST: ["contrast"],
            PipelineOperationType.OBJECT_DETECTION: ["detection_threshold"],
        }
        allowed_keys = set(parameter_map.get(self.operation, []))

        for field_name, value in self.parameters.model_dump(exclude_none=True).items():
            if field_name not in allowed_keys:
                raise ValueError(
                    f"{self.operation.value} では {field_name} パラメータは使用できません。"
                )

        return self


class PipelinePlan(BaseModel):
    source_instruction: str = Field(min_length=1, max_length=500)
    interpreter: PipelineInterpreterMode
    summary: str = Field(min_length=1, max_length=300)
    confidence: PipelinePlanConfidence = PipelinePlanConfidence.MEDIUM
    notes: list[str] = Field(default_factory=list, max_length=8)
    steps: list[PipelineStep] = Field(default_factory=list, max_length=8)


class PipelineInterpretRequest(BaseModel):
    instruction: str = Field(min_length=1, max_length=500)
    mode: PipelineInterpreterMode | None = None


class PipelineInterpretResponse(BaseModel):
    plan: PipelinePlan
