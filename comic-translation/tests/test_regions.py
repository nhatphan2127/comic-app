from comic_translator.models.detector import normalize_label
from comic_translator.processing.regions import build_regions, dedupe, reading_order
from comic_translator.schemas import Detection, TextRegion


def test_normalize_label():
    assert normalize_label("text_free") == "text_free"
    assert normalize_label("Text-Bubble") == "text_bubble"
    assert normalize_label("bubble") == "bubble"


def test_dedupe_keeps_best():
    dets = [Detection((0, 0, 10, 10), "bubble", 0.5), Detection((0, 0, 10, 11), "bubble", 0.9)]
    assert [d.score for d in dedupe(dets)] == [0.9]


def test_build_regions_links_text_to_bubble():
    dets = [
        Detection((0, 0, 100, 100), "bubble", 0.9),
        Detection((20, 20, 80, 60), "text_bubble", 0.9),
        Detection((200, 200, 260, 220), "text_free", 0.9),
        Detection((300, 0, 400, 80), "bubble", 0.9),  # empty bubble -> fallback region
    ]
    regions = build_regions(dets, include_free=False)
    assert [(r.kind, r.bubble_box) for r in regions] == [
        ("bubble", (0, 0, 100, 100)),
        ("bubble", (300, 0, 400, 80)),
    ]
    assert len(build_regions(dets, include_free=True)) == 3


def test_reading_order_ltr_and_rtl():
    a = TextRegion((0, 0, 50, 50), "bubble")
    b = TextRegion((100, 10, 150, 60), "bubble")
    c = TextRegion((0, 200, 50, 250), "bubble")
    assert reading_order([c, b, a]) == [a, b, c]
    assert reading_order([c, b, a], rtl=True) == [b, a, c]
