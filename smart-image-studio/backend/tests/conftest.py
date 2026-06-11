import io
from collections.abc import Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from PIL import Image


def make_png_bytes(width: int = 10, height: int = 10, color: tuple[int, int, int] = (128, 128, 128)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (width, height), color=color).save(buf, format="PNG")
    return buf.getvalue()


@pytest.fixture
def png_bytes() -> bytes:
    return make_png_bytes()


def _all_cached_fns() -> list:
    from app.core.config import get_settings
    from app.dependencies.service_dependency import (
        get_image_processor,
        get_job_repository,
        get_job_service,
        get_storage_service,
    )
    return [get_settings, get_image_processor, get_storage_service, get_job_repository, get_job_service]


@pytest.fixture(autouse=True)
def clear_lru_caches() -> Generator[None, None, None]:
    for fn in _all_cached_fns():
        fn.cache_clear()
    yield
    for fn in _all_cached_fns():
        fn.cache_clear()


@pytest.fixture(scope="session")
def tmp_upload_dir(tmp_path_factory: pytest.TempPathFactory) -> Path:
    return tmp_path_factory.mktemp("uploads")


@pytest.fixture()
def client(tmp_upload_dir: Path, monkeypatch: pytest.MonkeyPatch) -> Generator[TestClient, None, None]:
    from app.core.config import Settings, get_settings
    from app.main import create_app

    monkeypatch.setenv("SMART_IMAGE_STUDIO_UPLOAD_DIR", str(tmp_upload_dir))
    get_settings.cache_clear()

    test_settings = Settings(upload_dir=str(tmp_upload_dir))
    test_app = create_app(test_settings)
    test_app.dependency_overrides[get_settings] = lambda: test_settings
    with TestClient(test_app) as c:
        yield c
    get_settings.cache_clear()
