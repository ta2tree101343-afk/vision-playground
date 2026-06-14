import re


def sanitize_stem(stem: str) -> str:
    normalized = re.sub(r"[^a-zA-Z0-9_-]+", "-", stem).strip("-")
    return normalized or "image"
