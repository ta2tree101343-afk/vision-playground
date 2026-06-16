from app.schemas.image import (
    BackgroundRemovalResult,
    BoundingBox,
    CaptionCandidate,
    CaptionResult,
    DetectedObject,
    ImageAnalysisResult,
    ObjectDetectionResult,
    OcrLine,
    OcrResult,
)
from app.services.image_processor import ImageProcessor


def _ocr_result(text: str = "hello") -> ImageAnalysisResult:
    return ImageAnalysisResult(
        ocr=OcrResult(
            full_text=text,
            lines=[OcrLine(text=text, confidence=0.9, bounding_box=BoundingBox(x=0, y=0, width=10, height=10))],
        )
    )


def _bg_result() -> ImageAnalysisResult:
    return ImageAnalysisResult(background_removal=BackgroundRemovalResult(foreground_ratio=0.6))


def _detection_result(labels: list[str]) -> ImageAnalysisResult:
    detections = [
        DetectedObject(label=label, confidence=0.9, bounding_box=BoundingBox(x=0, y=0, width=10, height=10))
        for label in labels
    ]
    return ImageAnalysisResult(object_detection=ObjectDetectionResult(model="test", threshold=0.45, detections=detections))


# --- _merge_analysis ---

def test_merge_both_none_returns_none() -> None:
    assert ImageProcessor._merge_analysis(None, None) is None


def test_merge_incoming_none_returns_current_unchanged() -> None:
    current = _ocr_result("original")
    result = ImageProcessor._merge_analysis(current, None)
    assert result is current
    assert result.ocr.full_text == "original"  # type: ignore[union-attr]


def test_merge_current_none_returns_incoming() -> None:
    incoming = _ocr_result("new")
    result = ImageProcessor._merge_analysis(None, incoming)
    assert result is incoming


def test_merge_incoming_ocr_overwrites_current_ocr() -> None:
    current = _ocr_result("old")
    incoming = _ocr_result("new")
    result = ImageProcessor._merge_analysis(current, incoming)
    assert result.ocr.full_text == "new"  # type: ignore[union-attr]


def test_merge_incoming_field_does_not_overwrite_if_none() -> None:
    current = _ocr_result("kept")
    incoming = _bg_result()
    result = ImageProcessor._merge_analysis(current, incoming)
    assert result.ocr is not None
    assert result.ocr.full_text == "kept"
    assert result.background_removal is not None


# --- _append_caption_candidates ---

def test_append_detection_labels_only_adds_one_candidate() -> None:
    analysis = _detection_result(["cat"])
    result = ImageProcessor._append_caption_candidates(analysis)
    assert result.captions is not None
    texts = [c.text for c in result.captions.candidates]
    assert any("cat" in t for t in texts)


def test_append_ocr_only_adds_candidate() -> None:
    analysis = _ocr_result("テキスト")
    result = ImageProcessor._append_caption_candidates(analysis)
    assert result.captions is not None
    assert any("テキスト" in c.text for c in result.captions.candidates)


def test_append_detection_and_ocr_generates_combined_candidate() -> None:
    analysis = _detection_result(["dog"])
    analysis.ocr = OcrResult(full_text="SALE", lines=[])
    result = ImageProcessor._append_caption_candidates(analysis)
    assert result.captions is not None
    texts = [c.text for c in result.captions.candidates]
    assert any("dog" in t for t in texts)
    assert any("SALE" in t for t in texts)
    assert any("dog" in t and "SALE" in t for t in texts)


def test_append_background_removal_adds_cutout_candidate() -> None:
    analysis = _bg_result()
    result = ImageProcessor._append_caption_candidates(analysis)
    assert result.captions is not None
    assert any("切り抜い" in c.text for c in result.captions.candidates)


def test_append_caps_at_four_candidates() -> None:
    analysis = _detection_result(["a", "b", "c"])
    analysis.ocr = OcrResult(full_text="text", lines=[])
    analysis.background_removal = BackgroundRemovalResult(foreground_ratio=0.5)
    result = ImageProcessor._append_caption_candidates(analysis)
    assert result.captions is not None
    assert len(result.captions.candidates) <= 4


def test_append_deduplicates_existing_candidates() -> None:
    existing_text = "cat を中心に捉えた画像"
    analysis = _detection_result(["cat"])
    analysis.captions = CaptionResult(candidates=[CaptionCandidate(text=existing_text)])
    result = ImageProcessor._append_caption_candidates(analysis)
    assert result.captions is not None
    texts = [c.text for c in result.captions.candidates]
    assert texts.count(existing_text) == 1


def test_append_preserves_error_message_when_no_candidates_generated() -> None:
    analysis = ImageAnalysisResult(
        captions=CaptionResult(candidates=[], error_message="LM Studio 接続失敗")
    )
    result = ImageProcessor._append_caption_candidates(analysis)
    assert result.captions is not None
    assert result.captions.error_message == "LM Studio 接続失敗"
    assert result.captions.candidates == []


def test_append_preserves_error_message_when_synthetic_candidates_added() -> None:
    analysis = _detection_result(["cat"])
    analysis.captions = CaptionResult(candidates=[], error_message="LM Studio 接続失敗")
    result = ImageProcessor._append_caption_candidates(analysis)
    assert result.captions is not None
    assert result.captions.error_message == "LM Studio 接続失敗"
    assert len(result.captions.candidates) > 0
