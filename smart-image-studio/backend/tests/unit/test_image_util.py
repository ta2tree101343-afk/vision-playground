from app.utils.image_util import build_asset_url


def test_build_asset_url_no_trailing_slash() -> None:
    assert build_asset_url("http://localhost:8000", "/uploads/originals/foo.png") == "http://localhost:8000/uploads/originals/foo.png"


def test_build_asset_url_trailing_slash_stripped() -> None:
    assert build_asset_url("http://localhost:8000/", "/uploads/originals/foo.png") == "http://localhost:8000/uploads/originals/foo.png"


def test_build_asset_url_multiple_trailing_slashes_stripped() -> None:
    assert build_asset_url("http://localhost:8000///", "/uploads/originals/foo.png") == "http://localhost:8000/uploads/originals/foo.png"
