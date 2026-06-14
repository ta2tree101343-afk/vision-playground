from io import BytesIO

from fastapi import HTTPException, UploadFile, status
from PIL import Image, UnidentifiedImageError

from app.core.constants import MAX_UPLOAD_SIZE_BYTES


async def read_and_validate_image(file: UploadFile) -> bytes:
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="ファイル名が不正です。")

    if file.content_type and not file.content_type.startswith("image/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="画像ファイルをアップロードしてください。")

    image_bytes = await file.read()
    await file.close()

    if not image_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="空のファイルは処理できません。")

    if len(image_bytes) > MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(status_code=status.HTTP_413_CONTENT_TOO_LARGE, detail="20MB を超える画像はアップロードできません。")

    try:
        image = Image.open(BytesIO(image_bytes))
        image.verify()
    except Image.DecompressionBombError as exc:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail="画像の展開サイズが大きすぎます。より小さい画像を使用してください。",
        ) from exc
    except (UnidentifiedImageError, OSError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="有効な画像ファイルではありません。") from exc

    return image_bytes
