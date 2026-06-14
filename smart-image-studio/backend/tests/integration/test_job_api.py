import json

from conftest import make_png_bytes
from fastapi.testclient import TestClient


def test_get_jobs_returns_empty_list_initially(client: TestClient) -> None:
    response = client.get("/api/images/jobs")
    assert response.status_code == 200
    assert response.json() == []


def test_get_unknown_job_returns_404(client: TestClient) -> None:
    response = client.get("/api/images/jobs/nonexistent-job-id")
    assert response.status_code == 404


def test_create_job_returns_202_with_queued_status(client: TestClient) -> None:
    operations = json.dumps([{"operation": "grayscale"}])
    response = client.post(
        "/api/images/jobs",
        files={"file": ("test.png", make_png_bytes(), "image/png")},
        data={"operations": operations},
    )
    assert response.status_code == 202
    body = response.json()
    assert body["status"] == "queued"
    assert "job_id" in body


def test_created_job_is_retrievable(client: TestClient) -> None:
    operations = json.dumps([{"operation": "grayscale"}])
    create_response = client.post(
        "/api/images/jobs",
        files={"file": ("test.png", make_png_bytes(), "image/png")},
        data={"operations": operations},
    )
    assert create_response.status_code == 202
    job_id = create_response.json()["job_id"]

    get_response = client.get(f"/api/images/jobs/{job_id}")
    assert get_response.status_code == 200
    assert get_response.json()["job_id"] == job_id


def test_health_endpoint_returns_ok(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_create_job_returns_503_when_queue_is_full(client: TestClient) -> None:
    from unittest.mock import AsyncMock, patch

    from app.core.exceptions import JobQueueFullError

    operations = json.dumps([{"operation": "grayscale"}])
    with patch("app.services.job_service.JobService.enqueue_job", new_callable=AsyncMock, side_effect=JobQueueFullError()):
        response = client.post(
            "/api/images/jobs",
            files={"file": ("test.png", make_png_bytes(), "image/png")},
            data={"operations": operations},
        )
    assert response.status_code == 503
