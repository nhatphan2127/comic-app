"""Step 5: erase the original English text."""
import numpy as np

from ..schemas import TextRegion, clip_box, pad_box

UNIFORM_STD = 25  # max colour std-dev on the region border to count as a flat background
STROKE_DIFF = 60  # summed RGB distance from background that marks a text pixel


def dilate(mask: np.ndarray, iterations: int = 2) -> np.ndarray:
    m = mask.astype(bool)
    for _ in range(iterations):
        grown = m.copy()
        grown[1:] |= m[:-1]
        grown[:-1] |= m[1:]
        grown[:, 1:] |= m[:, :-1]
        grown[:, :-1] |= m[:, 1:]
        m = grown
    return m


def clean_region(img: np.ndarray, region: TextRegion, pad: int = 3) -> None:
    """Erase text in-place. Records the background colour on the region."""
    h, w = img.shape[:2]
    x1, y1, x2, y2 = clip_box(pad_box(region.box, pad), w, h)
    roi = img[y1:y2, x1:x2]
    if roi.shape[0] < 2 or roi.shape[1] < 2:
        return

    ring = np.concatenate([roi[0], roi[-1], roi[:, 0], roi[:, -1]])
    bg = np.median(ring, axis=0).astype(np.uint8)
    region.bg_color = tuple(int(v) for v in bg)

    if region.kind == "bubble" and ring.std(axis=0).max() < UNIFORM_STD:
        diff = np.abs(roi.astype(np.int16) - bg.astype(np.int16)).sum(axis=2)
        roi[dilate(diff > STROKE_DIFF)] = bg
        return

    _inpaint(img, region, pad)


def _inpaint(img: np.ndarray, region: TextRegion, pad: int, margin: int = 12) -> None:
    """Non-flat background: OpenCV inpaint over the OCR line boxes (LaMa in Phase 3)."""
    import cv2

    h, w = img.shape[:2]
    wx1, wy1, wx2, wy2 = clip_box(pad_box(region.box, pad + margin), w, h)
    window = img[wy1:wy2, wx1:wx2]
    mask = np.zeros(window.shape[:2], np.uint8)
    for b in region.lines or [region.box]:
        bx1, by1, bx2, by2 = clip_box(pad_box(b, pad), w, h)
        mask[max(0, by1 - wy1) : by2 - wy1, max(0, bx1 - wx1) : bx2 - wx1] = 255
    window[:] = cv2.inpaint(window, mask, 5, cv2.INPAINT_TELEA)
