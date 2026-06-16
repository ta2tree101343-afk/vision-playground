from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from PIL import Image

from app.core.exceptions import ImageProcessingError
from app.infrastructure.llm.lm_studio_client import LmStudioVisionClient
from app.schemas.image import CaptionResult
from app.services.caption_service import CaptionService


def _blank_image() -> Image.Image:
    return Image.new("RGB", (10, 10), color=(128, 128, 128))


def _make_service() -> tuple[CaptionService, MagicMock]:
    client = MagicMock(spec=LmStudioVisionClient)
    return CaptionService(client), client


def test_generate_returns_caption_result_with_one_candidate() -> None:
    svc, client = _make_service()
    client.generate_caption.return_value = "a cat on a mat"

    result = svc.generate(_blank_image())

    assert isinstance(result, CaptionResult)
    assert len(result.candidates) == 1
    assert result.candidates[0].text == "a cat on a mat"


def test_generate_passes_image_to_client() -> None:
    svc, client = _make_service()
    client.generate_caption.return_value = "some text"
    image = _blank_image()

    svc.generate(image)

    client.generate_caption.assert_called_once_with(image)


def test_generate_result_has_no_error_message_on_success() -> None:
    svc, client = _make_service()
    client.generate_caption.return_value = "hello"

    result = svc.generate(_blank_image())

    assert result.error_message is None


def test_generate_propagates_image_processing_error() -> None:
    svc, client = _make_service()
    client.generate_caption.side_effect = ImageProcessingError("LM Studio unavailable")

    with pytest.raises(ImageProcessingError, match="LM Studio unavailable"):
        svc.generate(_blank_image())


def test_generate_strips_whitespace_from_client_text() -> None:
    svc, client = _make_service()
    # クライアントは strip 済みのテキストを返す契約だが、サービスはそのまま渡す
    client.generate_caption.return_value = "trimmed text"

    result = svc.generate(_blank_image())

    assert result.candidates[0].text == "trimmed text"
