import json
from json import JSONDecodeError

from fastapi import HTTPException, status
from pydantic import ValidationError

from app.schemas.image import ImageOperationStep


def parse_operation_steps(operations: str) -> list[ImageOperationStep]:
    try:
        raw_operations = json.loads(operations)
    except JSONDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="operations フィールドは JSON 配列で指定してください。",
        ) from exc

    if not isinstance(raw_operations, list) or len(raw_operations) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="operations には 1 件以上の処理を指定してください。")

    try:
        return [ImageOperationStep.model_validate(item) for item in raw_operations]
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=exc.errors(include_url=False)) from exc
