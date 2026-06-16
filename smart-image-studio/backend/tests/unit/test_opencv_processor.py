"""opencv_processor.py のユニットテスト。

各画像変換関数の出力サイズ・モード・基本的な画素値変化を検証する。
"""

from __future__ import annotations

import numpy as np
import pytest
from PIL import Image

from app.infrastructure.image_processing.opencv_processor import (
    apply_background_removal,
    apply_blur,
    apply_brightness,
    apply_contrast,
    apply_denoise,
    apply_edge_detection,
    apply_grayscale,
    apply_sharpen,
    cv_to_pil,
    normalize_kernel_size,
    pil_to_cv,
)
from app.schemas.image import ImageOperationParameters


# ---------------------------------------------------------------------------
# ヘルパー
# ---------------------------------------------------------------------------

def _rgb(r: int, g: int, b: int, size: tuple[int, int] = (20, 20)) -> Image.Image:
    return Image.new("RGB", size, color=(r, g, b))


def _rgba(r: int, g: int, b: int, a: int = 200, size: tuple[int, int] = (20, 20)) -> Image.Image:
    return Image.new("RGBA", size, color=(r, g, b, a))


def _params(**kwargs: object) -> ImageOperationParameters:
    return ImageOperationParameters(**kwargs)


# ---------------------------------------------------------------------------
# normalize_kernel_size
# ---------------------------------------------------------------------------

class TestNormalizeKernelSize:
    def test_odd_value_unchanged(self) -> None:
        assert normalize_kernel_size(5) == 5

    def test_even_value_incremented_to_odd(self) -> None:
        assert normalize_kernel_size(4) == 5

    def test_another_even_value(self) -> None:
        assert normalize_kernel_size(6) == 7

    def test_below_min_clamped_to_1(self) -> None:
        assert normalize_kernel_size(0) == 1

    def test_above_max_clamped_to_25(self) -> None:
        assert normalize_kernel_size(30) == 25

    def test_max_odd_value_unchanged(self) -> None:
        assert normalize_kernel_size(25) == 25

    def test_even_at_max_boundary(self) -> None:
        # 24 → clamp to 24 → 24 is even → 25
        assert normalize_kernel_size(24) == 25

    def test_value_1_unchanged(self) -> None:
        assert normalize_kernel_size(1) == 1


# ---------------------------------------------------------------------------
# pil_to_cv / cv_to_pil
# ---------------------------------------------------------------------------

class TestPilCvConversion:
    def test_pil_to_cv_shape(self) -> None:
        img = _rgb(100, 150, 200)
        cv = pil_to_cv(img)
        assert cv.shape == (20, 20, 3)

    def test_pil_to_cv_bgr_channel_order(self) -> None:
        img = _rgb(255, 0, 0)  # 純赤
        cv = pil_to_cv(img)
        # BGR 順なので B=0, G=0, R=255
        assert cv[0, 0, 0] == 0    # B
        assert cv[0, 0, 1] == 0    # G
        assert cv[0, 0, 2] == 255  # R

    def test_round_trip_preserves_pixels(self) -> None:
        img = _rgb(80, 120, 200)
        result = cv_to_pil(pil_to_cv(img))
        assert result.mode == "RGB"
        assert result.getpixel((0, 0)) == (80, 120, 200)


# ---------------------------------------------------------------------------
# apply_grayscale
# ---------------------------------------------------------------------------

class TestApplyGrayscale:
    def test_rgb_output_has_equal_channels(self) -> None:
        result = apply_grayscale(_rgb(200, 100, 50))
        px = result.getpixel((0, 0))
        # グレースケール = 各チャンネルが同値
        assert px[0] == px[1] == px[2]

    def test_rgba_alpha_preserved(self) -> None:
        img = _rgba(200, 100, 50, a=128)
        result = apply_grayscale(img)
        assert result.mode == "RGBA"
        assert result.getpixel((0, 0))[3] == 128

    def test_output_size_unchanged(self) -> None:
        img = _rgb(100, 100, 100, size=(30, 40))
        assert apply_grayscale(img).size == (30, 40)

    def test_pure_white_stays_white(self) -> None:
        result = apply_grayscale(_rgb(255, 255, 255))
        px = result.getpixel((0, 0))
        assert all(v >= 250 for v in px[:3])

    def test_pure_black_stays_black(self) -> None:
        result = apply_grayscale(_rgb(0, 0, 0))
        px = result.getpixel((0, 0))
        assert all(v == 0 for v in px[:3])


# ---------------------------------------------------------------------------
# apply_blur
# ---------------------------------------------------------------------------

class TestApplyBlur:
    def test_output_size_unchanged_rgb(self) -> None:
        result = apply_blur(_rgb(100, 150, 200, size=(30, 40)), _params(blur_strength=3))
        assert result.size == (30, 40)

    def test_output_size_unchanged_rgba(self) -> None:
        result = apply_blur(_rgba(100, 150, 200, size=(30, 40)), _params(blur_strength=3))
        assert result.size == (30, 40)

    def test_rgba_alpha_preserved(self) -> None:
        result = apply_blur(_rgba(100, 150, 200, a=180), _params(blur_strength=3))
        assert result.mode == "RGBA"
        # 均一色なのでアルファはほぼ維持される
        assert result.getpixel((10, 10))[3] > 150

    def test_default_strength_when_none(self) -> None:
        result = apply_blur(_rgb(100, 150, 200), _params())
        assert result.size == (20, 20)

    def test_blur_with_sigma(self) -> None:
        result = apply_blur(_rgb(100, 150, 200), _params(blur_strength=5, blur_sigma=2.0))
        assert result.size == (20, 20)

    def test_uniform_image_unchanged_after_blur(self) -> None:
        """均一色画像はぼかしても色が変わらない。"""
        img = _rgb(100, 150, 200)
        result = apply_blur(img, _params(blur_strength=5))
        px = result.getpixel((10, 10))
        assert abs(px[0] - 100) <= 2
        assert abs(px[1] - 150) <= 2
        assert abs(px[2] - 200) <= 2


# ---------------------------------------------------------------------------
# apply_sharpen
# ---------------------------------------------------------------------------

class TestApplySharpen:
    def test_output_size_unchanged(self) -> None:
        result = apply_sharpen(_rgb(100, 150, 200, size=(30, 40)), _params(sharpen_strength=2))
        assert result.size == (30, 40)

    def test_rgba_alpha_preserved(self) -> None:
        result = apply_sharpen(_rgba(100, 150, 200, a=200), _params(sharpen_strength=3))
        assert result.mode == "RGBA"
        assert result.getpixel((10, 10))[3] == 200

    def test_uniform_image_unchanged(self) -> None:
        """均一色はシャープ化しても変化しない（エッジがないため）。"""
        img = _rgb(128, 128, 128)
        result = apply_sharpen(img, _params(sharpen_strength=5))
        px = result.getpixel((10, 10))
        assert abs(px[0] - 128) <= 5

    def test_default_strength(self) -> None:
        result = apply_sharpen(_rgb(100, 100, 100), _params())
        assert result.size == (20, 20)


# ---------------------------------------------------------------------------
# apply_denoise
# ---------------------------------------------------------------------------

class TestApplyDenoise:
    def test_output_size_unchanged(self) -> None:
        result = apply_denoise(_rgb(100, 150, 200, size=(30, 40)), _params(denoise_strength=5))
        assert result.size == (30, 40)

    def test_rgba_alpha_preserved(self) -> None:
        result = apply_denoise(_rgba(100, 150, 200, a=180), _params(denoise_strength=5))
        assert result.mode == "RGBA"
        assert result.getpixel((10, 10))[3] == 180

    def test_default_strength(self) -> None:
        result = apply_denoise(_rgb(100, 100, 100), _params())
        assert result.size == (20, 20)


# ---------------------------------------------------------------------------
# apply_edge_detection
# ---------------------------------------------------------------------------

class TestApplyEdgeDetection:
    def test_output_size_unchanged(self) -> None:
        result = apply_edge_detection(_rgb(100, 150, 200, size=(30, 40)))
        assert result.size == (30, 40)

    def test_output_mode_is_rgb(self) -> None:
        result = apply_edge_detection(_rgb(100, 150, 200))
        assert result.mode == "RGB"

    def test_uniform_image_has_no_edges(self) -> None:
        """均一色にはエッジが存在しないため、出力はほぼ黒になる。"""
        result = apply_edge_detection(_rgb(128, 128, 128))
        arr = np.array(result)
        assert arr.mean() < 10

    def test_rgba_alpha_preserved(self) -> None:
        result = apply_edge_detection(_rgba(100, 150, 200, a=180))
        assert result.mode == "RGBA"
        assert result.getpixel((10, 10))[3] == 180


# ---------------------------------------------------------------------------
# apply_brightness
# ---------------------------------------------------------------------------

class TestApplyBrightness:
    def test_positive_brightness_increases_pixel_values(self) -> None:
        img = _rgb(100, 100, 100)
        result = apply_brightness(img, _params(brightness=50))
        px = result.getpixel((0, 0))
        assert px[0] > 100

    def test_negative_brightness_decreases_pixel_values(self) -> None:
        img = _rgb(200, 200, 200)
        result = apply_brightness(img, _params(brightness=-50))
        px = result.getpixel((0, 0))
        assert px[0] < 200

    def test_brightness_minus_100_yields_black(self) -> None:
        result = apply_brightness(_rgb(200, 200, 200), _params(brightness=-100))
        px = result.getpixel((0, 0))
        assert all(v == 0 for v in px[:3])

    def test_zero_brightness_unchanged(self) -> None:
        img = _rgb(150, 100, 80)
        result = apply_brightness(img, _params(brightness=0))
        assert result.getpixel((0, 0)) == img.getpixel((0, 0))

    def test_output_size_unchanged(self) -> None:
        assert apply_brightness(_rgb(100, 100, 100, size=(30, 40)), _params(brightness=20)).size == (30, 40)

    def test_rgba_alpha_preserved(self) -> None:
        result = apply_brightness(_rgba(100, 100, 100, a=180), _params(brightness=50))
        assert result.mode == "RGBA"
        assert result.getpixel((0, 0))[3] == 180


# ---------------------------------------------------------------------------
# apply_contrast
# ---------------------------------------------------------------------------

class TestApplyContrast:
    def test_positive_contrast_increases_deviation_from_gray(self) -> None:
        img = _rgb(200, 200, 200)
        result = apply_contrast(img, _params(contrast=50))
        px = result.getpixel((0, 0))
        # 明るいピクセルはさらに明るくなる
        assert px[0] >= 200

    def test_contrast_minus_100_yields_flat_color(self) -> None:
        """factor=0 → Pillow は画像の平均輝度に基づく均一色に収束する。"""
        result = apply_contrast(_rgb(200, 50, 200), _params(contrast=-100))
        arr = np.array(result)
        # 全ピクセルが同一値になる（分散ゼロ）
        assert arr[:, :, 0].std() == 0.0
        assert arr[:, :, 1].std() == 0.0

    def test_zero_contrast_unchanged(self) -> None:
        img = _rgb(150, 100, 80)
        result = apply_contrast(img, _params(contrast=0))
        assert result.getpixel((0, 0)) == img.getpixel((0, 0))

    def test_output_size_unchanged(self) -> None:
        assert apply_contrast(_rgb(100, 100, 100, size=(30, 40)), _params(contrast=30)).size == (30, 40)

    def test_rgba_alpha_preserved(self) -> None:
        result = apply_contrast(_rgba(100, 100, 100, a=200), _params(contrast=30))
        assert result.mode == "RGBA"
        assert result.getpixel((0, 0))[3] == 200


# ---------------------------------------------------------------------------
# apply_background_removal
# ---------------------------------------------------------------------------

class TestApplyBackgroundRemoval:
    @pytest.fixture
    def sample_image(self) -> Image.Image:
        # GrabCut には最低限のサイズが必要
        return Image.new("RGB", (60, 60), color=(100, 150, 200))

    def test_returns_rgba_image(self, sample_image: Image.Image) -> None:
        result_img, _, _ = apply_background_removal(sample_image)
        assert result_img.mode == "RGBA"

    def test_output_size_matches_input(self, sample_image: Image.Image) -> None:
        result_img, _, _ = apply_background_removal(sample_image)
        assert result_img.size == sample_image.size

    def test_analysis_foreground_ratio_in_range(self, sample_image: Image.Image) -> None:
        _, analysis, _ = apply_background_removal(sample_image)
        assert analysis.background_removal is not None
        ratio = analysis.background_removal.foreground_ratio
        assert 0.0 <= ratio <= 1.0

    def test_mask_is_grayscale(self, sample_image: Image.Image) -> None:
        _, _, mask = apply_background_removal(sample_image)
        assert mask.mode == "L"

    def test_mask_size_matches_input(self, sample_image: Image.Image) -> None:
        _, _, mask = apply_background_removal(sample_image)
        assert mask.size == sample_image.size
