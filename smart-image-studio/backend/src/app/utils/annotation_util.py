from PIL import ImageDraw

from app.schemas.image import BoundingBox


def draw_label(
    drawer: ImageDraw.ImageDraw,
    box: BoundingBox,
    text: str,
    *,
    color: str,
    max_chars: int,
    label_width: int,
) -> None:
    label_top = max(0, box.y - 18)
    drawer.rectangle((box.x, label_top, box.x + label_width, label_top + 18), fill=color)
    drawer.text((box.x + 6, label_top + 3), text[:max_chars], fill="white")
