from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from PIL import Image

from app.core.exceptions import ImageProcessingError
from app.infrastructure.llm.lm_studio_client import LmStudioVisionClient


def _blank_image() -> Image.Image:
    return Image.new("RGB", (10, 10), color=(128, 128, 128))


def _make_response(content: str | None, num_choices: int = 1) -> MagicMock:
    response = MagicMock()
    if num_choices == 0:
        response.choices = []
    else:
        choice = MagicMock()
        choice.message.content = content
        response.choices = [choice]
    return response


@pytest.fixture
def client_and_mock() -> tuple[LmStudioVisionClient, MagicMock]:
    mock_openai = MagicMock()
    with patch("app.infrastructure.llm.lm_studio_client.OpenAI", return_value=mock_openai):
        client = LmStudioVisionClient(base_url="http://test", model="test-model")
    return client, mock_openai


def test_generate_caption_returns_text_from_response(client_and_mock: tuple) -> None:
    client, mock_openai = client_and_mock
    mock_openai.chat.completions.create.return_value = _make_response("a cat on a mat")

    result = client.generate_caption(_blank_image())

    assert result == "a cat on a mat"


def test_generate_caption_strips_surrounding_whitespace(client_and_mock: tuple) -> None:
    client, mock_openai = client_and_mock
    mock_openai.chat.completions.create.return_value = _make_response("  trimmed text  ")

    result = client.generate_caption(_blank_image())

    assert result == "trimmed text"


def test_generate_caption_empty_choices_raises_image_processing_error(client_and_mock: tuple) -> None:
    client, mock_openai = client_and_mock
    mock_openai.chat.completions.create.return_value = _make_response(None, num_choices=0)

    with pytest.raises(ImageProcessingError):
        client.generate_caption(_blank_image())


def test_generate_caption_none_content_raises_image_processing_error(client_and_mock: tuple) -> None:
    client, mock_openai = client_and_mock
    mock_openai.chat.completions.create.return_value = _make_response(None)

    with pytest.raises(ImageProcessingError):
        client.generate_caption(_blank_image())


def test_generate_caption_api_exception_wrapped_as_image_processing_error(client_and_mock: tuple) -> None:
    client, mock_openai = client_and_mock
    mock_openai.chat.completions.create.side_effect = ConnectionError("timeout")

    with pytest.raises(ImageProcessingError, match="キャプション生成に失敗しました"):
        client.generate_caption(_blank_image())


def test_generate_caption_image_processing_error_not_double_wrapped(client_and_mock: tuple) -> None:
    client, mock_openai = client_and_mock
    # choices が空の場合に raise された ImageProcessingError が再 raise されること（二重ラップされないこと）を確認
    mock_openai.chat.completions.create.return_value = _make_response(None, num_choices=0)

    with pytest.raises(ImageProcessingError) as exc_info:
        client.generate_caption(_blank_image())

    # 二重ラップされると "キャプション生成に失敗しました" になるが、元のメッセージが維持される
    assert "キャプション生成に失敗しました。サービスへの接続に" not in exc_info.value.args[0]
