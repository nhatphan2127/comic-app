"""Debug overlay: bubbles in green, bubble text in blue, free text in orange."""
from PIL import Image, ImageDraw

from ..schemas import TextRegion

COLORS = {"bubble": (0, 160, 255), "free": (255, 120, 0)}
BUBBLE_COLOR = (0, 200, 0)
FLAGGED_COLOR = (255, 0, 0)


def draw_debug(image: Image.Image, regions: list[TextRegion]) -> Image.Image:
    img = image.copy()
    draw = ImageDraw.Draw(img)
    for r in regions:
        color = FLAGGED_COLOR if r.issue else COLORS.get(r.kind, FLAGGED_COLOR)
        if r.bubble_box:
            draw.rectangle(r.bubble_box, outline=BUBBLE_COLOR, width=2)
        draw.rectangle(r.box, outline=color, width=2)
        draw.text((r.box[0], r.box[1] - 12), str(r.order), fill=color)
    return img
