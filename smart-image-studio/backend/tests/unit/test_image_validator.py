import io

import pytest
from fastapi import HTTPException, UploadFile

from conftest import make_png_bytes


def _make_upload_file(
    content: bytes,
    filename: str = "test.png",
    content_type: str = "image/png",
) -> UploadFile:
    return UploadFile(file=io.BytesIO(content), filename=filename, size=len(content), headers={"content-type": content_type})


async def test_valid_image_returns_bytes() -> None:
    from app.validators.image_validator import read_and_validate_image

    data = make_png_bytes()
    upload = _make_upload_file(data)
    result = await read_and_validate_image(upload)
    assert result == data


async def test_missing_filename_raises_400() -> None:
    from app.validators.image_validator import read_and_validate_image

    upload = _make_upload_file(make_png_bytes(), filename="")
    with pytest.raises(HTTPException) as exc_info:
        await read_and_validate_image(upload)
    assert exc_info.value.status_code == 400


async def test_non_image_content_type_raises_400() -> None:
    from app.validators.image_validator import read_and_validate_image

    upload = _make_upload_file(b"some text", filename="doc.txt", content_type="text/plain")
    with pytest.raises(HTTPException) as exc_info:
        await read_and_validate_image(upload)
    assert exc_info.value.status_code == 400


async def test_empty_body_raises_400() -> None:
    from app.validators.image_validator import read_and_validate_image

    upload = _make_upload_file(b"", filename="empty.png")
    with pytest.raises(HTTPException) as exc_info:
        await read_and_validate_image(upload)
    assert exc_info.value.status_code == 400


async def test_oversized_file_raises_413() -> None:
    from app.core.constants import MAX_UPLOAD_SIZE_BYTES
    from app.validators.image_validator import read_and_validate_image

    oversized = b"x" * (MAX_UPLOAD_SIZE_BYTES + 1)
    upload = _make_upload_file(oversized, filename="big.png")
    with pytest.raises(HTTPException) as exc_info:
        await read_and_validate_image(upload)
    assert exc_info.value.status_code == 413


async def test_corrupt_image_bytes_raises_400() -> None:
    from app.validators.image_validator import read_and_validate_image

    upload = _make_upload_file(b"not an image at all", filename="corrupt.png")
    with pytest.raises(HTTPException) as exc_info:
        await read_and_validate_image(upload)
    assert exc_info.value.status_code == 400


async def test_decompression_bomb_raises_413() -> None:
    from unittest.mock import MagicMock, patch

    from PIL import Image

    from app.validators.image_validator import read_and_validate_image

    mock_img = MagicMock()
    mock_img.verify.side_effect = Image.DecompressionBombError("too large")
    upload = _make_upload_file(make_png_bytes(), filename="bomb.png")
    with patch("app.validators.image_validator.Image.open", return_value=mock_img):
        with pytest.raises(HTTPException) as exc_info:
            await read_and_validate_image(upload)
    assert exc_info.value.status_code == 413
