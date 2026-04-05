from fastapi import APIRouter, HTTPException, status
from pydantic import ValidationError

from app.schemas.pipeline import PipelineInterpretRequest, PipelineInterpretResponse
from app.services.pipeline_interpreter import PipelineInterpretationError
from app.services.pipeline_interpreter_factory import get_pipeline_interpreter

router = APIRouter()


@router.post("/interpret", response_model=PipelineInterpretResponse)
def interpret_pipeline(request: PipelineInterpretRequest) -> PipelineInterpretResponse:
    interpreter = get_pipeline_interpreter(request.mode)

    try:
        plan = interpreter.interpret(request.instruction)
    except PipelineInterpretationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=exc.errors(include_url=False),
        ) from exc

    return PipelineInterpretResponse(plan=plan)
