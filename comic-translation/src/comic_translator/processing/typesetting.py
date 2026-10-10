"""Step 6: draw the Vietnamese text back into each region."""
import unicodedata
from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from ..config import ROOT, Config
from ..schemas import Box, TextRegion

FALLBACK_FONTS = [
    "C:/Windows/Fonts/arial.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
]
INSCRIBED = 0.72  # a rectangle ~72% of an ellipse's bounding box fits inside it
BUBBLE_MARGIN = 4


def find_font(path: str | None = None) -> str:
    if path:
        if not Path(path).is_file():
            raise FileNotFoundError(path)
        return path
    for p in sorted((ROOT / "assets" / "fonts").glob("*")):
        if p.suffix.lower() in (".ttf", ".otf"):
            return str(p)
    for p in FALLBACK_FONTS:
        if Path(p).is_file():
            return p
    raise FileNotFoundError("no font found: put a Vietnamese-capable .ttf in comic-translation/assets/fonts/")


@lru_cache(maxsize=256)
def load_font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


def layout_box(region: TextRegion) -> Box:
    """Area available for the translation."""
    tx1, ty1, tx2, ty2 = region.box
    if region.bubble_box is None:
        return (tx1 - 2, ty1 - 2, tx2 + 2, ty2 + 2)
    bx1, by1, bx2, by2 = region.bubble_box
    cx, cy = (bx1 + bx2) / 2, (by1 + by2) / 2
    hw, hh = (bx2 - bx1) * INSCRIBED / 2, (by2 - by1) * INSCRIBED / 2
    x1, y1 = min(cx - hw, tx1), min(cy - hh, ty1)
    x2, y2 = max(cx + hw, tx2), max(cy + hh, ty2)
    m = BUBBLE_MARGIN
    return (
        int(max(x1, bx1 + m)),
        int(max(y1, by1 + m)),
        int(min(x2, bx2 - m)),
        int(min(y2, by2 - m)),
    )


def wrap(text: str, font: ImageFont.FreeTypeFont, max_w: float) -> list[str]:
    lines: list[str] = []
    line = ""
    for word in text.split():
        candidate = f"{line} {word}" if line else word
        if font.getlength(candidate) <= max_w:
            line = candidate
            continue
        if line:
            lines.append(line)
        # a single word wider than the box: break it by characters
        while font.getlength(word) > max_w and len(word) > 1:
            cut = len(word) - 1
            while cut > 1 and font.getlength(word[:cut] + "-") > max_w:
                cut -= 1
            lines.append(word[:cut] + "-")
            word = word[cut:]
        line = word
    if line:
        lines.append(line)
    return lines


def fit_text(text: str, font_path: str, w: int, h: int, cfg: Config):
    """Largest font size whose wrapped text fits in w x h. Returns (font, lines, line_height)."""

    def layout(size: int):
        font = load_font(font_path, size)
        lines = wrap(text, font, w)
        line_h = int(size * cfg.line_spacing)
        fits = len(lines) * line_h <= h and all(font.getlength(l) <= w for l in lines)
        return fits, font, lines, line_h

    lo, hi = cfg.min_font_size, max(cfg.min_font_size, min(cfg.max_font_size, h))
    best = None
    while lo <= hi:
        mid = (lo + hi) // 2
        fits, *result = layout(mid)
        if fits:
            best, lo = result, mid + 1
        else:
            hi = mid - 1
    return best or layout(cfg.min_font_size)[1:]  # overflow at min size: draw anyway


def _luminance(c: tuple[int, int, int]) -> float:
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


def draw_region(img: Image.Image, region: TextRegion, cfg: Config, font_path: str) -> None:
    text = unicodedata.normalize("NFC", region.translation.strip())
    if not text:
        return
    if cfg.uppercase:
        text = text.upper()

    x1, y1, x2, y2 = layout_box(region)
    w, h = x2 - x1, y2 - y1
    if w < 4 or h < 4:
        return
    font, lines, line_h = fit_text(text, font_path, w, h, cfg)

    dark_bg = _luminance(region.bg_color) < 128
    fill = (255, 255, 255) if dark_bg else (0, 0, 0)
    stroke = 0 if region.kind == "bubble" else max(1, font.size // 12)
    stroke_fill = (0, 0, 0) if dark_bg else (255, 255, 255)

    draw = ImageDraw.Draw(img)
    cx = (x1 + x2) / 2
    top = (y1 + y2) / 2 - len(lines) * line_h / 2
    for i, line in enumerate(lines):
        draw.text(
            (cx, top + (i + 0.5) * line_h), line, font=font, fill=fill, anchor="mm",
            stroke_width=stroke, stroke_fill=stroke_fill,
        )
