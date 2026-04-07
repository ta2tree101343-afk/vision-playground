from enum import Enum

from pydantic import BaseModel, Field

from app.schemas.image import ImageOperationStep


class PipelineInterpreterMode(str, Enum):
    RULE_BASED = "rule_based"
    LLM = "llm"


class PipelinePlanConfidence(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class PipelinePlan(BaseModel):
    source_instruction: str = Field(min_length=1, max_length=500)
    interpreter: PipelineInterpreterMode
    summary: str = Field(min_length=1, max_length=300)
    confidence: PipelinePlanConfidence = PipelinePlanConfidence.MEDIUM
    notes: list[str] = Field(default_factory=list, max_length=8)
    steps: list[ImageOperationStep] = Field(default_factory=list, max_length=8)


class PipelineInterpretRequest(BaseModel):
    instruction: str = Field(min_length=1, max_length=500)
    mode: PipelineInterpreterMode | None = None


class PipelineInterpretResponse(BaseModel):
    plan: PipelinePlan
