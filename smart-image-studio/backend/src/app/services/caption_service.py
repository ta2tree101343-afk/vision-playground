from PIL import Image

from app.infrastructure.llm.lm_studio_client import LmStudioVisionClient
from app.schemas.image import CaptionCandidate, CaptionResult


class CaptionService:
    def __init__(self, client: LmStudioVisionClient) -> None:
        self._client = client

    def generate(self, image: Image.Image) -> CaptionResult:
        text = self._client.generate_caption(image)
        return CaptionResult(candidates=[CaptionCandidate(text=text)])
