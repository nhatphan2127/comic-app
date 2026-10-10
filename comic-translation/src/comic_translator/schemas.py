from dataclasses import dataclass, field, asdict

Box = tuple[int, int, int, int]  # x1, y1, x2, y2 in page pixels


@dataclass
class Detection:
    box: Box
    label: str  # bubble | text_bubble | text_free
    score: float


@dataclass
class TextRegion:
    box: Box
    kind: str  # "bubble" (text inside a speech bubble) | "free"
    score: float = 1.0
    bubble_box: Box | None = None
    text: str = ""
    ocr_conf: float = 0.0
    lines: list[Box] = field(default_factory=list)  # OCR line boxes, page coords
    source: str = ""  # cleaned text sent to the translator
    translation: str = ""
    issue: str | None = None  # set by the review step; needs a human look if still set
    order: int = -1
    bg_color: tuple[int, int, int] = (255, 255, 255)

    def to_dict(self) -> dict:
        return asdict(self)


def area(b: Box) -> int:
    return max(0, b[2] - b[0]) * max(0, b[3] - b[1])


def intersection(a: Box, b: Box) -> int:
    return area((max(a[0], b[0]), max(a[1], b[1]), min(a[2], b[2]), min(a[3], b[3])))


def iou(a: Box, b: Box) -> float:
    inter = intersection(a, b)
    union = area(a) + area(b) - inter
    return inter / union if union else 0.0


def clip_box(b: Box, w: int, h: int) -> Box:
    return (max(0, b[0]), max(0, b[1]), min(w, b[2]), min(h, b[3]))


def pad_box(b: Box, p: int) -> Box:
    return (b[0] - p, b[1] - p, b[2] + p, b[3] + p)
