from collections.abc import Generator
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def no_raise_client(tmp_upload_dir: Path, monkeypatch: pytest.MonkeyPatch) -> Generator[TestClient, None, None]:
    from app.core.config import Settings, get_settings
    from app.main import app

    monkeypatch.setenv("SMART_IMAGE_STUDIO_UPLOAD_DIR", str(tmp_upload_dir))
    get_settings.cache_clear()
    app.dependency_overrides[get_settings] = lambda: Settings(upload_dir=str(tmp_upload_dir))
    # raise_server_exceptions=False lets the app's exception handler return the response
    # instead of the test client re-raising the exception.
    c = TestClient(app, raise_server_exceptions=False)
    yield c
    app.dependency_overrides.clear()
    get_settings.cache_clear()


def test_unhandled_exception_returns_500_with_detail(no_raise_client: TestClient) -> None:
    from app.controllers.job_controller import JobController

    with patch.object(JobController, "list_jobs", side_effect=RuntimeError("unexpected crash")):
        response = no_raise_client.get("/api/images/jobs")

    assert response.status_code == 500
    assert response.json() == {"detail": "内部サーバーエラーが発生しました。"}


def test_http_exception_is_not_swallowed_by_handler(client: TestClient) -> None:
    response = client.get("/api/images/jobs/nonexistent-id")
    assert response.status_code == 404
