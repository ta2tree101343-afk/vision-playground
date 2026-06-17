"""RapidOcrEngine の純粋メソッドのテスト。

RapidOCR 本体（重量モデル）をパッチしてエンジン初期化をスキップし、
静的メソッド _points_to_bounding_box と
インスタンスメソッド _prepare_for_ocr をテストする。
"""

from __future__ import annotations

from unittest.mock import patch

import pytest
from PIL import Image

from app.infrastructure.ocr.rapidocr import OcrEngineConfig, RapidOcrEngine
from app.schemas.image import BoundingBox


@pytest.fixture
def engine() -> RapidOcrEngine:
    """デフォルト設定（target_long_side=1600）のエンジン。"""
    with patch("app.infrastructure.ocr.rapidocr.RapidOCR"):
        return RapidOcrEngine()


@pytest.fixture
def small_target_engine() -> RapidOcrEngine:
    """target_long_side=200 に絞った設定。小さな画像で拡大ロジックをテストしやすくする。"""
    with patch("app.infrastructure.ocr.rapidocr.RapidOCR"):
        return RapidOcrEngine(config=OcrEngineConfig(target_long_side=200))


# ---------------------------------------------------------------------------
# _points_to_bounding_box
# ---------------------------------------------------------------------------


def test_points_to_bounding_box_normal_rectangle() -> None:
    points = [[10.0, 20.0], [110.0, 20.0], [110.0, 70.0], [10.0, 70.0]]
    box = RapidOcrEngine._points_to_bounding_box(points)
    assert box == BoundingBox(x=10, y=20, width=100, height=50)


def test_points_to_bounding_box_negative_x_clamped_to_zero() -> None:
    points = [[-5.0, 0.0], [50.0, 0.0], [50.0, 30.0], [-5.0, 30.0]]
    box = RapidOcrEngine._points_to_bounding_box(points)
    assert box.x == 0


def test_points_to_bounding_box_negative_y_clamped_to_zero() -> None:
    points = [[10.0, -8.0], [60.0, -8.0], [60.0, 30.0], [10.0, 30.0]]
    box = RapidOcrEngine._points_to_bounding_box(points)
    assert box.y == 0


def test_points_to_bounding_box_width_adjusted_when_x_clamped() -> None:
    # min_x が負 → 0 にクランプ、width は int(max_x) - 0 = int(max_x)
    points = [[-5.0, 0.0], [50.0, 0.0], [50.0, 20.0], [-5.0, 20.0]]
    box = RapidOcrEngine._points_to_bounding_box(points)
    assert box.x == 0
    assert box.width == 50


def test_points_to_bounding_box_min_width_is_1_when_x_values_identical() -> None:
    # 全 x が同じ → int(max) - min_x = 0 → max(1, 0) = 1
    points = [[50.0, 0.0], [50.0, 0.0], [50.0, 30.0], [50.0, 30.0]]
    box = RapidOcrEngine._points_to_bounding_box(points)
    assert box.width == 1


def test_points_to_bounding_box_min_height_is_1_when_y_values_identical() -> None:
    points = [[0.0, 50.0], [40.0, 50.0], [40.0, 50.0], [0.0, 50.0]]
    box = RapidOcrEngine._points_to_bounding_box(points)
    assert box.height == 1


def test_points_to_bounding_box_float_coords_truncated() -> None:
    # int() は切り捨て
    points = [[10.9, 20.9], [60.1, 20.9], [60.1, 50.1], [10.9, 50.1]]
    box = RapidOcrEngine._points_to_bounding_box(points)
    assert box.x == 10  # int(max(0, 10.9)) = 10
    assert box.y == 20  # int(max(0, 20.9)) = 20
    assert box.width == 50  # int(60.1) - 10 = 50
    assert box.height == 30  # int(50.1) - 20 = 30


# ---------------------------------------------------------------------------
# _prepare_for_ocr
# ---------------------------------------------------------------------------


def test_prepare_for_ocr_large_image_returned_unchanged(engine: RapidOcrEngine) -> None:
    # long_side (2000) >= target_long_side (1600) → そのまま返す
    img = Image.new("RGB", (2000, 1500))
    result, scale = engine._prepare_for_ocr(img)
    assert result is img
    assert scale == 1.0


def test_prepare_for_ocr_image_at_exact_target_returned_unchanged(engine: RapidOcrEngine) -> None:
    # long_side == target_long_side: 境界条件 >= により縮小されない
    img = Image.new("RGB", (1600, 1200))
    result, scale = engine._prepare_for_ocr(img)
    assert result is img
    assert scale == 1.0


def test_prepare_for_ocr_small_image_scale_correct(small_target_engine: RapidOcrEngine) -> None:
    # target_long_side=200, long_side=100 → scale=2.0
    img = Image.new("RGB", (100, 80))
    _, scale = small_target_engine._prepare_for_ocr(img)
    assert scale == pytest.approx(2.0)


def test_prepare_for_ocr_small_image_output_size_matches_scale(small_target_engine: RapidOcrEngine) -> None:
    img = Image.new("RGB", (100, 80))
    result, scale = small_target_engine._prepare_for_ocr(img)
    assert result.width == int(100 * scale)
    assert result.height == int(80 * scale)


def test_prepare_for_ocr_small_image_not_same_object(small_target_engine: RapidOcrEngine) -> None:
    # 拡大されたときは新しい Image が返る
    img = Image.new("RGB", (50, 50))
    result, _ = small_target_engine._prepare_for_ocr(img)
    assert result is not img


def test_prepare_for_ocr_scale_based_on_long_side_when_portrait(small_target_engine: RapidOcrEngine) -> None:
    # 縦長画像: height が長辺 → height を基準にスケール
    img = Image.new("RGB", (80, 100))  # height=100 が長辺、scale=200/100=2.0
    _, scale = small_target_engine._prepare_for_ocr(img)
    assert scale == pytest.approx(2.0)
