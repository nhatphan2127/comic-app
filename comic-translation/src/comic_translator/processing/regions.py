"""Turn raw detections into text regions and put them in reading order."""
from ..schemas import Box, Detection, TextRegion, area, intersection, iou


def dedupe(detections: list[Detection], thresh: float = 0.7) -> list[Detection]:
    kept: list[Detection] = []
    for d in sorted(detections, key=lambda d: -d.score):
        if all(k.label != d.label or iou(k.box, d.box) < thresh for k in kept):
            kept.append(d)
    return kept


def _containing_bubble(box: Box, bubbles: list[Box], min_cover: float = 0.5) -> Box | None:
    best, best_cover = None, min_cover
    for b in bubbles:
        cover = intersection(box, b) / max(1, area(box))
        if cover >= best_cover:
            best, best_cover = b, cover
    return best


def _shrink(b: Box, ratio: float) -> Box:
    dx = int((b[2] - b[0]) * (1 - ratio) / 2)
    dy = int((b[3] - b[1]) * (1 - ratio) / 2)
    return (b[0] + dx, b[1] + dy, b[2] - dx, b[3] - dy)


def build_regions(detections: list[Detection], include_free: bool) -> list[TextRegion]:
    """Each text box becomes a region, linked to the bubble that contains it (if any)."""
    bubbles = [d.box for d in detections if d.label == "bubble"]
    regions: list[TextRegion] = []
    used_bubbles: set[Box] = set()

    for d in detections:
        if d.label not in ("text_bubble", "text_free"):
            continue
        bubble = _containing_bubble(d.box, bubbles)
        if bubble is not None:
            used_bubbles.add(bubble)
            regions.append(TextRegion(d.box, "bubble", d.score, bubble_box=bubble))
        elif d.label == "text_bubble":
            # bubble text without a matching bubble box: still treat it as bubble text
            regions.append(TextRegion(d.box, "bubble", d.score))
        elif include_free:
            regions.append(TextRegion(d.box, "free", d.score))

    # bubbles where no text box was found: OCR the bubble interior as a fallback
    for b in bubbles:
        if b not in used_bubbles:
            regions.append(TextRegion(_shrink(b, 0.8), "bubble", 0.0, bubble_box=b))
    return regions


def _anchor(r: TextRegion) -> Box:
    return r.bubble_box or r.box


def reading_order(regions: list[TextRegion], rtl: bool = False) -> list[TextRegion]:
    """Row by row (top to bottom), then by x. Panel-aware ordering is Phase 2."""
    rows: list[list[TextRegion]] = []
    for r in sorted(regions, key=lambda r: _anchor(r)[1]):
        _, y1, _, y2 = _anchor(r)
        for row in rows:
            ry1 = min(_anchor(x)[1] for x in row)
            ry2 = max(_anchor(x)[3] for x in row)
            if min(y2, ry2) - max(y1, ry1) > 0.5 * min(y2 - y1, ry2 - ry1):
                row.append(r)
                break
        else:
            rows.append([r])

    ordered = [r for row in rows for r in sorted(row, key=lambda r: _anchor(r)[0], reverse=rtl)]
    for i, r in enumerate(ordered):
        r.order = i
    return ordered
