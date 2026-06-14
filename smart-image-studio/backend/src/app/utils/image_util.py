from app.schemas.image import ImageAnalysisResult, ImageOperationStep, ProcessImageResponse


def build_asset_url(base_url: str, public_path: str) -> str:
    return f"{base_url.rstrip('/')}{public_path}"


def build_process_response(
    *,
    base_url: str,
    original_public_path: str,
    processed_public_path: str,
    processed_filename: str,
    operations: list[ImageOperationStep],
    analysis: ImageAnalysisResult | None,
) -> ProcessImageResponse:
    return ProcessImageResponse(
        message="画像処理が完了しました。",
        original_image_url=build_asset_url(base_url, original_public_path),
        processed_image_url=build_asset_url(base_url, processed_public_path),
        processed_filename=processed_filename,
        applied_operations=operations,
        analysis=analysis,
    )
