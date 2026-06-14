from PIL import Image

from app.infrastructure.ocr.rapidocr import OcrExecutionResult, RapidOcrEngine


class OcrService:
    def __init__(self) -> None:
        self._engine = RapidOcrEngine()

    def recognize(self, image: Image.Image) -> OcrExecutionResult:
        return self._engine.recognize(image)
