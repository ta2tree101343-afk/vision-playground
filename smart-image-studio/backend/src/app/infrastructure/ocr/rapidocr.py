"""日本語・英語・数字に最適化した OCR エンジン。

前段パイプライン（Brightness → Contrast → Sharpen）で画質補正済みの画像を受け取り、
OCR ノードとしては「正立化」「解像度の最適化」「認識」だけを担う。

設計方針:
- 前処理の二重がけを避ける（明度/コントラスト/シャープは前段の責務）。
- 座標は常に「向き補正後・元解像度」の空間で返す（フロントの重畳表示とズレない）。
- ライブラリ版数に依存しやすい Cls.ocr_version は明示せず、デフォルトに委ねる。
- FastAPI のスレッドプール実行を想定し、推論呼び出しを直列化する。
"""

from __future__ import annotations

import logging
import threading
from dataclasses import dataclass

import numpy as np  # type: ignore
from PIL import Image, ImageDraw, ImageOps
from rapidocr import (  # type: ignore
    EngineType,
    LangDet,
    LangRec,
    ModelType,
    OCRVersion,
    RapidOCR,
)

from app.core.exceptions import ImageProcessingError
from app.schemas.image import BoundingBox, OcrLine, OcrResult
from app.utils.annotation_util import draw_label

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class OcrExecutionResult:
    """OCR 実行結果。overlay は向き補正後・元解像度の注釈付き画像。"""

    overlay: Image.Image
    result: OcrResult


@dataclass(frozen=True)
class OcrEngineConfig:
    """OCR エンジンの調整パラメータ。テスト時に差し替えやすいよう外出し。"""

    # 認識に最適な長辺の目安。これより小さい画像だけ拡大する。
    target_long_side: int = 1600
    # 大画像の縮小はライブラリ側に任せる際の上限。
    max_side_len: int = 2000
    # この信頼度未満の行は捨てる（誤読の混入を防ぐ）。
    text_score: float = 0.5
    # オフライン/Lambda 運用時にローカルモデルを使う場合のパス（任意）。
    # 指定しなければ初回実行時に自動ダウンロードされる。
    det_model_path: str | None = None
    rec_model_path: str | None = None


class RapidOcrEngine:
    """RapidOCR v3 をラップした OCR エンジン。

    - 検出 (Det): PP-OCRv5。傾き・歪みに強い。
    - 方向分類 (Cls): use_cls=True で有効化。バージョンは自動選択。
    - 認識 (Rec): PP-OCRv4 japan。日本語＋英数字に辞書を限定し、中国語字体の混入を防ぐ。
    """

    def __init__(self, config: OcrEngineConfig | None = None) -> None:
        self._config = config or OcrEngineConfig()
        # RapidOCR インスタンスはスレッドセーフ保証がないため直列化する。
        self._lock = threading.Lock()

        params: dict[str, object] = {
            # --- 検出: v5（頑健） ---
            "Det.engine_type": EngineType.ONNXRUNTIME,
            "Det.ocr_version": OCRVersion.PPOCRV5,
            "Det.lang_type": LangDet.CH,
            "Det.model_type": ModelType.MOBILE,
            # --- 認識: v4 japan（日本語＋英数字に限定） ---
            "Rec.engine_type": EngineType.ONNXRUNTIME,
            "Rec.ocr_version": OCRVersion.PPOCRV4,
            "Rec.lang_type": LangRec.JAPAN,
            "Rec.model_type": ModelType.MOBILE,  # japan は mobile のみ提供
            # --- 共通 ---
            "Global.max_side_len": self._config.max_side_len,
            # 注: Cls.ocr_version はあえて指定しない。
            #     PP-OCRv5 cls は rapidocr>=3.8.0、PP-OCRv4 cls は <3.8.0 でのみ有効なため、
            #     明示すると版数次第で起動時に "File not Found" になる。use_cls=True に委ねる。
        }
        # ローカルモデルが指定されていれば上書き（自動ダウンロードを回避）。
        if self._config.det_model_path:
            params["Det.model_path"] = self._config.det_model_path
        if self._config.rec_model_path:
            params["Rec.model_path"] = self._config.rec_model_path

        try:
            self._engine = RapidOCR(params=params)
        except Exception as exc:
            logger.exception("OCR エンジンの初期化に失敗しました")
            raise ImageProcessingError("OCR エンジンの初期化に失敗しました。") from exc

    def recognize(self, image: Image.Image) -> OcrExecutionResult:
        """画像から文字を認識する。

        返り値の BoundingBox と overlay は、いずれも
        「EXIF 向き補正後・元解像度」の座標空間で一致している。
        """
        # 向き補正後・元解像度のカラー画像。座標と overlay の基準はこれに統一する。
        base = ImageOps.exif_transpose(image).convert("RGB")

        # 小さい画像だけ拡大して OCR に渡す（拡大率 scale は座標復元に使う）。
        ocr_input, scale = self._prepare_for_ocr(base)

        try:
            with self._lock:
                result = self._engine(
                    np.array(ocr_input),
                    use_det=True,
                    use_cls=True,  # 回転画像（90度/180度）を自動補正
                    use_rec=True,
                    text_score=self._config.text_score,
                )
        except MemoryError:
            raise
        except Exception as exc:
            raise ImageProcessingError("OCR エンジンの実行に失敗しました。") from exc

        # boxes・txts・scores は同じ長さで揃う契約だが、1つでも None なら返す情報がない。
        if result.boxes is None or result.txts is None or result.scores is None or len(result.boxes) == 0:
            return OcrExecutionResult(overlay=base, result=OcrResult(full_text="", lines=[]))

        overlay = base.copy()
        drawer = ImageDraw.Draw(overlay)
        lines: list[OcrLine] = []

        for raw_points, text, confidence in zip(result.boxes, result.txts, result.scores):
            cleaned = str(text).strip()
            if not cleaned or float(confidence) < self._config.text_score:
                continue

            # OCR は拡大後の座標を返すので、scale で割って元解像度に戻す。
            points = [[float(p[0]) / scale, float(p[1]) / scale] for p in raw_points]
            bounding_box = self._points_to_bounding_box(points)

            lines.append(OcrLine(text=cleaned, confidence=float(confidence), bounding_box=bounding_box))
            drawer.polygon([tuple(point) for point in points], outline="#0f766e", width=3)
            draw_label(
                drawer,
                bounding_box,
                f"OCR {cleaned}",
                color="#0f766e",
                max_chars=22,
                label_width=140,
            )

        full_text = "\n".join(line.text for line in lines)
        return OcrExecutionResult(overlay=overlay, result=OcrResult(full_text=full_text, lines=lines))

    def _prepare_for_ocr(self, base: Image.Image) -> tuple[Image.Image, float]:
        """OCR に渡す画像を整える。小さい画像のみ拡大する。

        Returns:
            (OCR 入力画像, 適用した拡大率 scale)。scale=1.0 なら拡大なし。
        """
        long_side = max(base.width, base.height)
        if long_side >= self._config.target_long_side:
            return base, 1.0

        scale = self._config.target_long_side / long_side
        new_size = (int(base.width * scale), int(base.height * scale))
        # LANCZOS は拡大時のジャギーを抑えられる高品質な補間。
        return base.resize(new_size, Image.Resampling.LANCZOS), scale

    @staticmethod
    def _points_to_bounding_box(points: list[list[float]]) -> BoundingBox:
        x_values = [point[0] for point in points]
        y_values = [point[1] for point in points]
        min_x = int(max(0, min(x_values)))
        min_y = int(max(0, min(y_values)))
        return BoundingBox(
            x=min_x,
            y=min_y,
            width=max(1, int(max(x_values)) - min_x),
            height=max(1, int(max(y_values)) - min_y),
        )
