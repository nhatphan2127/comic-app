"""Step 2: read English text inside each region."""
import numpy as np

from ..processing.text import normalize_ocr
from ..schemas import Box, clip_box, pad_box

MIN_CROP_HEIGHT = 64  # upscale small crops; EasyOCR struggles with tiny lettering


class OCR:
    def __init__(self, langs: tuple[str, ...], gpu: bool, min_conf: float = 0.2):
        import easyocr

        self.reader = easyocr.Reader(list(langs), gpu=gpu, verbose=False)
        self.min_conf = min_conf

    def read(self, image: np.ndarray, box: Box, pad: int = 4) -> tuple[str, float, list[Box]]:
        """Return (text, mean confidence, line boxes in page coords)."""
        h, w = image.shape[:2]
        x1, y1, x2, y2 = clip_box(pad_box(box, pad), w, h)
        crop = image[y1:y2, x1:x2]
        if crop.size == 0:
            return "", 0.0, []

        scale = 1.0
        if crop.shape[0] < MIN_CROP_HEIGHT:
            import cv2

            scale = MIN_CROP_HEIGHT / crop.shape[0]
            crop = cv2.resize(crop, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)

        items = []
        for pts, text, conf in self.reader.readtext(crop, detail=1, paragraph=False):
            if conf < self.min_conf or not text.strip():
                continue
            xs = [p[0] / scale for p in pts]
            ys = [p[1] / scale for p in pts]
            line_box = (int(min(xs)) + x1, int(min(ys)) + y1, int(max(xs)) + x1, int(max(ys)) + y1)
            items.append((line_box, text, conf))
        if not items:
            return "", 0.0, []

        items = sort_lines(items)
        text = normalize_ocr([t for _, t, _ in items])
        conf = float(np.mean([c for _, _, c in items]))
        return text, conf, [b for b, _, _ in items]


def sort_lines(items: list[tuple[Box, str, float]]) -> list[tuple[Box, str, float]]:
    """Top-to-bottom, then left-to-right for fragments on the same line."""
    items = sorted(items, key=lambda it: (it[0][1] + it[0][3]) / 2)
    rows: list[list] = []
    for it in items:
        cy = (it[0][1] + it[0][3]) / 2
        if rows:
            last = rows[-1][0][0]
            if abs(cy - (last[1] + last[3]) / 2) < (last[3] - last[1]) / 2:
                rows[-1].append(it)
                continue
        rows.append([it])
    return [it for row in rows for it in sorted(row, key=lambda it: it[0][0])]
