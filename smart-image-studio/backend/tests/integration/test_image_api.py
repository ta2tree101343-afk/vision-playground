import json
from unittest.mock import patch

from conftest import make_png_bytes
from fastapi.testclient import TestClient


def test_process_image_grayscale_returns_200(client: TestClient) -> None:
    operations = json.dumps([{"operation": "grayscale"}])
    response = client.post(
        "/api/images/process",
        files={"file": ("test.png", make_png_bytes(), "image/png")},
        data={"operations": operations},
    )
    assert response.status_code == 200
    body = response.json()
    assert "original_image_url" in body
    assert "processed_image_url" in body
    assert body["applied_operations"][0]["operation"] == "grayscale"
    assert body["analysis"] is None


def test_process_image_invalid_operations_json_returns_400(client: TestClient) -> None:
    response = client.post(
        "/api/images/process",
        files={"file": ("test.png", make_png_bytes(), "image/png")},
        data={"operations": "not valid json"},
    )
    assert response.status_code == 400


def test_process_image_empty_operations_returns_400(client: TestClient) -> None:
    response = client.post(
        "/api/images/process",
        files={"file": ("test.png", make_png_bytes(), "image/png")},
        data={"operations": "[]"},
    )
    assert response.status_code == 400


def test_process_image_unknown_operation_returns_400(client: TestClient) -> None:
    operations = json.dumps([{"operation": "nonexistent_op"}])
    response = client.post(
        "/api/images/process",
        files={"file": ("test.png", make_png_bytes(), "image/png")},
        data={"operations": operations},
    )
    assert response.status_code == 400


def test_process_image_missing_file_returns_422(client: TestClient) -> None:
    operations = json.dumps([{"operation": "grayscale"}])
    response = client.post(
        "/api/images/process",
        data={"operations": operations},
    )
    assert response.status_code == 422


def test_process_image_returns_500_on_image_processing_error(client: TestClient) -> None:
    from app.core.exceptions import ImageProcessingError
    operations = json.dumps([{"operation": "grayscale"}])
    with patch("app.services.image_processor.ImageProcessor.process", side_effect=ImageProcessingError("cv2 failed")):
        response = client.post(
            "/api/images/process",
            files={"file": ("test.png", make_png_bytes(), "image/png")},
            data={"operations": operations},
        )
    assert response.status_code == 500


def test_process_image_returns_500_on_mask_save_error(client: TestClient) -> None:
    from app.core.exceptions import MaskSaveError
    operations = json.dumps([{"operation": "grayscale"}])
    with patch("app.controllers.image_controller.save_and_build_response", side_effect=MaskSaveError("mask write failed")):
        response = client.post(
            "/api/images/process",
            files={"file": ("test.png", make_png_bytes(), "image/png")},
            data={"operations": operations},
        )
    assert response.status_code == 500


def test_process_image_returns_500_on_os_error(client: TestClient) -> None:
    operations = json.dumps([{"operation": "grayscale"}])
    with patch("app.services.storage_service.StorageService.save_original", side_effect=OSError("disk full")):
        response = client.post(
            "/api/images/process",
            files={"file": ("test.png", make_png_bytes(), "image/png")},
            data={"operations": operations},
        )
    assert response.status_code == 500


def test_process_image_brightness_with_valid_parameter_returns_200(client: TestClient) -> None:
    operations = json.dumps([{"operation": "brightness", "parameters": {"brightness": 30}}])
    response = client.post(
        "/api/images/process",
        files={"file": ("test.png", make_png_bytes(), "image/png")},
        data={"operations": operations},
    )
    assert response.status_code == 200


def test_process_image_unknown_parameter_returns_400(client: TestClient) -> None:
    operations = json.dumps([{"operation": "grayscale", "parameters": {"unknown_param": 99}}])
    response = client.post(
        "/api/images/process",
        files={"file": ("test.png", make_png_bytes(), "image/png")},
        data={"operations": operations},
    )
    assert response.status_code == 400


def test_process_image_unknown_step_field_returns_400(client: TestClient) -> None:
    operations = json.dumps([{"operation": "grayscale", "extra_step_field": "value"}])
    response = client.post(
        "/api/images/process",
        files={"file": ("test.png", make_png_bytes(), "image/png")},
        data={"operations": operations},
    )
    assert response.status_code == 400


def test_process_image_returns_503_when_object_detection_model_unavailable(client: TestClient) -> None:
    from app.core.exceptions import ModelNotAvailableError

    operations = json.dumps([{"operation": "object_detection"}])
    with patch("app.services.image_processor.ImageProcessor.process", side_effect=ModelNotAvailableError("no caffemodel")):
        response = client.post(
            "/api/images/process",
            files={"file": ("test.png", make_png_bytes(), "image/png")},
            data={"operations": operations},
        )
    assert response.status_code == 503


def test_process_image_503_detail_does_not_leak_model_path(client: TestClient) -> None:
    from app.core.exceptions import ModelNotAvailableError

    operations = json.dumps([{"operation": "object_detection"}])
    with patch("app.services.image_processor.ImageProcessor.process", side_effect=ModelNotAvailableError("no caffemodel")):
        response = client.post(
            "/api/images/process",
            files={"file": ("test.png", make_png_bytes(), "image/png")},
            data={"operations": operations},
        )
    assert "caffemodel" not in response.json()["detail"]
