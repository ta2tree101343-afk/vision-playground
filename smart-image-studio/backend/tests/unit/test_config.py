from __future__ import annotations

from app.core.config import Settings
from app.core.responses import UnicodeJSONResponse


def _settings(cors_origins: str, upload_dir: str = "uploads") -> Settings:
    """バリデーションとenv読み込みをスキップして Settings を構築する。"""
    return Settings.model_construct(cors_origins=cors_origins, upload_dir=upload_dir)


# ---------------------------------------------------------------------------
# Settings.cors_origin_list
# ---------------------------------------------------------------------------


def test_cors_origin_list_single_origin() -> None:
    s = _settings("http://localhost:5173")
    assert s.cors_origin_list == ["http://localhost:5173"]


def test_cors_origin_list_multiple_origins() -> None:
    s = _settings("http://localhost:5173,https://example.com")
    assert s.cors_origin_list == ["http://localhost:5173", "https://example.com"]


def test_cors_origin_list_strips_whitespace_around_commas() -> None:
    s = _settings("http://localhost:5173 , https://example.com")
    assert s.cors_origin_list == ["http://localhost:5173", "https://example.com"]


def test_cors_origin_list_filters_empty_entries() -> None:
    # "a,,b" → ["a", "b"]（連続カンマを無視）
    s = _settings("http://localhost:5173,,https://example.com")
    assert s.cors_origin_list == ["http://localhost:5173", "https://example.com"]


def test_cors_origin_list_empty_string_returns_empty_list() -> None:
    s = _settings("")
    assert s.cors_origin_list == []


def test_cors_origin_list_whitespace_only_returns_empty_list() -> None:
    s = _settings("  ,  ,  ")
    assert s.cors_origin_list == []


# ---------------------------------------------------------------------------
# Settings.upload_path
# ---------------------------------------------------------------------------


def test_upload_path_uses_upload_dir() -> None:
    s = _settings("", upload_dir="my_uploads")
    assert s.upload_path.name == "my_uploads"


def test_upload_path_is_under_project_root() -> None:
    s = _settings("", upload_dir="uploads")
    assert s.upload_path == s.project_root / "uploads"


# ---------------------------------------------------------------------------
# UnicodeJSONResponse.render
# ---------------------------------------------------------------------------


def _render(content: object) -> str:
    return UnicodeJSONResponse(content=None).render(content).decode("utf-8")


def test_unicode_response_does_not_escape_japanese() -> None:
    result = _render({"message": "こんにちは"})
    assert "こんにちは" in result


def test_unicode_response_is_compact_without_spaces() -> None:
    # separators=(",", ":") → キーと値の間にスペースなし
    result = _render({"a": 1, "b": 2})
    assert ": " not in result
    assert ", " not in result


def test_unicode_response_output_is_valid_utf8_bytes() -> None:
    raw: bytes = UnicodeJSONResponse(content=None).render({"text": "日本語"})
    assert isinstance(raw, bytes)
    assert "日本語" in raw.decode("utf-8")
