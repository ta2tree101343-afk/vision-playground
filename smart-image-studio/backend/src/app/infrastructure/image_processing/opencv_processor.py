from collections.abc import Callable

import cv2  # type: ignore
import numpy as np  # type: ignore
from PIL import Image, ImageEnhance

from app.core.exceptions import ImageProcessingError
from app.schemas.image import BackgroundRemovalResult, ImageAnalysisResult, ImageOperationParameters

# BT.709 輝度係数（線形光用）— OpenCV BGR 順
# Y = 0.2126R + 0.7152G + 0.0722B
_BT709_B = 0.0722
_BT709_G = 0.7152
_BT709_R = 0.2126
_BT709_BGR = np.array([[_BT709_B, _BT709_G, _BT709_R]], dtype=np.float32)

# シャープ化: LAB 空間 Unsharp Mask の係数・上限
_SHARPEN_STRENGTH_MAX = 5
_SHARPEN_SMOOTH_SIGMA = 0.8  # Laplacian 前の平滑化 sigma
_SHARPEN_HALO_SCALE = 0.3  # ハロー上限をローカルコントラストの何倍に抑えるか
_SHARPEN_HALO_MIN = 2.0  # ハロー上限の最低値
_SHARPEN_FACTOR_SCALE = 0.35  # ユーザー強度を Laplacian 係数にスケール

# fastNlMeansDenoising ウィンドウサイズ
_DENOISE_TEMPLATE_WINDOW = 7
_DENOISE_SEARCH_WINDOW = 21

# Canny auto-threshold: 中央値 ± sigma 倍でアダプティブに設定
_CANNY_SIGMA = 0.33

# GrabCut 背景除去
_GRABCUT_MARGIN_RATIO = 0.05  # マージン幅を短辺の何割にするか
_GRABCUT_ITERATIONS = 5


def _srgb_to_linear(c: np.ndarray) -> np.ndarray:
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def _linear_to_srgb(c: np.ndarray) -> np.ndarray:
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * (c ** (1.0 / 2.4)) - 0.055)


def pil_to_cv(image: Image.Image) -> np.ndarray:
    rgb = np.array(image.convert("RGB"))
    return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)


def cv_to_pil(image: np.ndarray) -> Image.Image:
    rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    return Image.fromarray(rgb)


def normalize_kernel_size(value: int) -> int:
    normalized = max(1, min(value, 25))
    if normalized % 2 == 0:
        normalized += 1
    return normalized


def _apply_rgb_preserve_alpha(
    image: Image.Image,
    transform: Callable[[Image.Image], Image.Image],
) -> Image.Image:
    """RGB 変換を alpha チャンネルを失わずに適用する。RGBA 画像の場合、alpha を復元する。"""
    if image.mode != "RGBA":
        return transform(image.convert("RGB"))
    alpha = image.getchannel("A")
    rgb_result = transform(image.convert("RGB"))
    result = rgb_result.convert("RGBA")
    result.putalpha(alpha)
    return result


def apply_grayscale(image: Image.Image) -> Image.Image:
    def _transform(img: Image.Image) -> Image.Image:
        cv_image = pil_to_cv(img)
        # sRGB EOTF → 線形光で BT.709 係数混合 → sRGB OETF
        img_linear = _srgb_to_linear(cv_image.astype(np.float32) / 255.0)
        img_gray_linear = np.clip(cv2.transform(img_linear, _BT709_BGR), 0.0, 1.0).squeeze()
        img_gray = (np.clip(_linear_to_srgb(img_gray_linear), 0.0, 1.0) * 255).astype("uint8")
        return Image.fromarray(img_gray).convert("RGB")

    return _apply_rgb_preserve_alpha(image, _transform)


def apply_blur(image: Image.Image, parameters: ImageOperationParameters) -> Image.Image:
    strength = parameters.blur_strength or 5
    kernel_size = normalize_kernel_size(strength)
    sigma = float(parameters.blur_sigma) if parameters.blur_sigma is not None else 0.0

    if image.mode != "RGBA":
        cv_image = pil_to_cv(image.convert("RGB"))
        try:
            blurred = cv2.GaussianBlur(cv_image, (kernel_size, kernel_size), sigmaX=sigma)
        except (cv2.error, ValueError) as exc:
            raise ImageProcessingError(f"ぼかし処理に失敗しました (kernel={kernel_size})。") from exc
        return cv_to_pil(blurred)

    # RGBA: premultiply → 4ch まとめてぼかし → un-premultiply（透明縁への背景色にじみ防止）
    rgba_f = np.array(image.convert("RGBA"), dtype=np.float32)
    alpha_f = rgba_f[:, :, 3:4] / np.float32(255.0)
    rgba_f[:, :, :3] *= alpha_f
    try:
        blurred_rgba = cv2.GaussianBlur(rgba_f, (kernel_size, kernel_size), sigmaX=sigma)
    except (cv2.error, ValueError) as exc:
        raise ImageProcessingError(f"ぼかし処理に失敗しました (kernel={kernel_size})。") from exc
    blurred_f: np.ndarray = np.asarray(blurred_rgba, dtype=np.float32)
    blurred_alpha = blurred_f[:, :, 3:4] / np.float32(255.0)
    safe_alpha = np.where(blurred_alpha > 0, blurred_alpha, np.float32(1.0))
    blurred_f[:, :, :3] /= safe_alpha  # type: ignore[misc]  # cv2 stubs lose float dtype
    return Image.fromarray(np.clip(blurred_f, 0, 255).astype(np.uint8), mode="RGBA")


def apply_sharpen(image: Image.Image, parameters: ImageOperationParameters) -> Image.Image:
    strength = max(1, min(parameters.sharpen_strength or 1, _SHARPEN_STRENGTH_MAX))

    def _transform(img: Image.Image) -> Image.Image:
        cv_image = pil_to_cv(img)
        try:
            lab = cv2.cvtColor(cv_image, cv2.COLOR_BGR2LAB)
            l_f = lab[:, :, 0].astype(np.float32)
            smoothed = cv2.GaussianBlur(l_f, (0, 0), sigmaX=_SHARPEN_SMOOTH_SIGMA)
            lap = cv2.Laplacian(smoothed, cv2.CV_32F, ksize=1)
            _kernel_3x3 = np.ones((3, 3), dtype=np.uint8)
            local_contrast = cv2.dilate(l_f, _kernel_3x3) - cv2.erode(l_f, _kernel_3x3)
            halo_limit = np.maximum(local_contrast * _SHARPEN_HALO_SCALE, _SHARPEN_HALO_MIN)
            lap = np.clip(lap, -halo_limit, halo_limit)
            sharpened = l_f - (strength * _SHARPEN_FACTOR_SCALE) * lap
            lab[:, :, 0] = np.clip(sharpened, 0, 255).astype(np.uint8)
            result = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
        except (cv2.error, ValueError) as exc:
            raise ImageProcessingError("シャープ化に失敗しました。") from exc
        return cv_to_pil(result)

    return _apply_rgb_preserve_alpha(image, _transform)


def apply_denoise(image: Image.Image, parameters: ImageOperationParameters) -> Image.Image:
    strength = max(1, min(parameters.denoise_strength or 8, 30))

    def _transform(img: Image.Image) -> Image.Image:
        cv_image = pil_to_cv(img)
        try:
            denoised = cv2.fastNlMeansDenoisingColored(
                cv_image,
                None,
                h=float(strength),
                hColor=float(strength),
                templateWindowSize=_DENOISE_TEMPLATE_WINDOW,
                searchWindowSize=_DENOISE_SEARCH_WINDOW,
            )
        except (cv2.error, ValueError) as exc:
            raise ImageProcessingError("ノイズ除去に失敗しました。") from exc
        return cv_to_pil(denoised)

    return _apply_rgb_preserve_alpha(image, _transform)


def apply_edge_detection(image: Image.Image) -> Image.Image:
    def _transform(img: Image.Image) -> Image.Image:
        cv_image = pil_to_cv(img)
        try:
            grayscale = cv2.cvtColor(cv_image, cv2.COLOR_BGR2GRAY)
            median = float(np.median(grayscale))
            low = max(0, int((1.0 - _CANNY_SIGMA) * median))
            high = min(255, int((1.0 + _CANNY_SIGMA) * median))
            high = max(high, low + 1)  # Canny requires threshold2 > threshold1
            edges = cv2.Canny(grayscale, threshold1=low, threshold2=high)
        except (cv2.error, ValueError) as exc:
            raise ImageProcessingError("エッジ検出に失敗しました。") from exc
        return Image.fromarray(edges).convert("RGB")

    return _apply_rgb_preserve_alpha(image, _transform)


def apply_brightness(image: Image.Image, parameters: ImageOperationParameters) -> Image.Image:
    brightness = parameters.brightness or 0
    factor = max(0.0, 1 + brightness / 100)

    def _transform(img: Image.Image) -> Image.Image:
        try:
            return ImageEnhance.Brightness(img).enhance(factor)
        except (ValueError, OSError) as exc:
            raise ImageProcessingError("明るさ調整に失敗しました。") from exc

    return _apply_rgb_preserve_alpha(image, _transform)


def apply_contrast(image: Image.Image, parameters: ImageOperationParameters) -> Image.Image:
    contrast = parameters.contrast or 0
    factor = max(0.0, 1 + contrast / 100)

    def _transform(img: Image.Image) -> Image.Image:
        try:
            return ImageEnhance.Contrast(img).enhance(factor)
        except (ValueError, OSError) as exc:
            raise ImageProcessingError("コントラスト調整に失敗しました。") from exc

    return _apply_rgb_preserve_alpha(image, _transform)


def apply_background_removal(image: Image.Image) -> tuple[Image.Image, ImageAnalysisResult, Image.Image]:
    image_rgb = image.convert("RGB")
    cv_image = pil_to_cv(image_rgb)
    height, width = cv_image.shape[:2]
    margin = max(1, int(min(width, height) * _GRABCUT_MARGIN_RATIO))
    rect_width = max(1, width - margin * 2)
    rect_height = max(1, height - margin * 2)
    rectangle = (margin, margin, rect_width, rect_height)
    mask = np.zeros((height, width), np.uint8)
    background_model = np.zeros((1, 65), np.float64)
    foreground_model = np.zeros((1, 65), np.float64)

    try:
        cv2.grabCut(cv_image, mask, rectangle, background_model, foreground_model, _GRABCUT_ITERATIONS, cv2.GC_INIT_WITH_RECT)
    except cv2.error as exc:
        raise ImageProcessingError("背景除去に失敗しました。") from exc

    alpha_mask = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype("uint8")
    cleaned_mask = cv2.morphologyEx(alpha_mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    rgba_image = image_rgb.convert("RGBA")
    rgba_image.putalpha(Image.fromarray(cleaned_mask))
    foreground_ratio = float(np.count_nonzero(cleaned_mask)) / float(cleaned_mask.size)
    analysis = ImageAnalysisResult(background_removal=BackgroundRemovalResult(foreground_ratio=foreground_ratio))
    background_mask = Image.fromarray(cleaned_mask).convert("L")
    return rgba_image, analysis, background_mask
