import base64
import logging
from io import BytesIO

from openai import OpenAI
from PIL import Image

from app.core.exceptions import ImageProcessingError

logger = logging.getLogger(__name__)

_CAPTION_PROMPT = "この画像を日本語で詳しく説明してください。"


class LmStudioVisionClient:
    def __init__(self, base_url: str, model: str, api_key: str = "lm-studio") -> None:
        self._client = OpenAI(base_url=base_url, api_key=api_key)
        self._model = model

    def generate_caption(self, image: Image.Image) -> str:
        buffer = BytesIO()
        image.convert("RGB").save(buffer, format="JPEG", quality=85)
        image_b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

        try:
            response = self._client.chat.completions.create(
                model=self._model,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": _CAPTION_PROMPT},
                            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"}},
                        ],
                    }
                ],
            )
            if not response.choices:
                raise ImageProcessingError(
                    "LM Studio のレスポンスが空です（choices リストが空）。モデルが正しくロードされているか確認してください。"
                )
            content = response.choices[0].message.content
            if not content:
                raise ImageProcessingError("LM Studio のレスポンスが空です。モデルが正しくロードされているか確認してください。")
            return content.strip()
        except ImageProcessingError:
            raise
        except Exception as exc:
            logger.exception("LM Studio API エラー: %s", exc)
            raise ImageProcessingError("キャプション生成に失敗しました。サービスへの接続に問題が発生しました。") from exc
