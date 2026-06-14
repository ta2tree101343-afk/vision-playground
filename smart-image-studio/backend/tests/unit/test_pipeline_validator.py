import json

import pytest
from fastapi import HTTPException

from app.schemas.image import OperationType
from app.validators.pipeline_validator import parse_operation_steps


def test_invalid_json_raises_400() -> None:
    with pytest.raises(HTTPException) as exc_info:
        parse_operation_steps("not valid json")
    assert exc_info.value.status_code == 400


def test_empty_list_raises_400() -> None:
    with pytest.raises(HTTPException) as exc_info:
        parse_operation_steps("[]")
    assert exc_info.value.status_code == 400


def test_valid_operations_json_returns_steps() -> None:
    payload = json.dumps([{"operation": "grayscale"}])
    steps = parse_operation_steps(payload)
    assert len(steps) == 1
    assert steps[0].operation == OperationType.GRAYSCALE


def test_invalid_operation_type_in_json_raises_400() -> None:
    payload = json.dumps([{"operation": "nonexistent_op"}])
    with pytest.raises(HTTPException) as exc_info:
        parse_operation_steps(payload)
    assert exc_info.value.status_code == 400


def test_even_blur_strength_raises_400() -> None:
    payload = json.dumps([{"operation": "blur", "parameters": {"blur_strength": 4}}])
    with pytest.raises(HTTPException) as exc_info:
        parse_operation_steps(payload)
    assert exc_info.value.status_code == 400


def test_odd_blur_strength_is_valid() -> None:
    payload = json.dumps([{"operation": "blur", "parameters": {"blur_strength": 5}}])
    steps = parse_operation_steps(payload)
    assert steps[0].parameters.blur_strength == 5


def test_unsupported_parameter_for_operation_raises_400() -> None:
    payload = json.dumps([{"operation": "grayscale", "parameters": {"brightness": 10}}])
    with pytest.raises(HTTPException) as exc_info:
        parse_operation_steps(payload)
    assert exc_info.value.status_code == 400
