import pytest

from app.utils.file_util import sanitize_stem


@pytest.mark.parametrize(
    ("stem", "expected"),
    [
        ("hello", "hello"),
        ("hello world", "hello-world"),
        ("hello_world-123", "hello_world-123"),
        ("abc!@#def", "abc-def"),
        ("  spaces  ", "spaces"),
        ("---", "image"),
        ("", "image"),
        ("日本語ファイル", "image"),
        ("mixed日本語123", "mixed-123"),
        ("a" * 200, "a" * 200),
    ],
)
def test_sanitize_stem(stem: str, expected: str) -> None:
    assert sanitize_stem(stem) == expected
