import numpy as np

from comic_translator.config import Config
from comic_translator.processing.cleaning import clean_region
from comic_translator.processing.typesetting import find_font, fit_text, layout_box, load_font, wrap
from comic_translator.schemas import TextRegion


def test_clean_bubble_removes_text():
    img = np.full((100, 200, 3), 255, np.uint8)
    img[40:60, 50:150] = 0  # "text"
    region = TextRegion((45, 35, 155, 65), "bubble")
    clean_region(img, region)
    assert img.min() == 255
    assert region.bg_color == (255, 255, 255)


def test_fit_text_stays_in_box():
    font, lines, line_h = fit_text(
        "Anh đang đi đâu vậy, John? Chúng ta phải rời khỏi đây ngay bây giờ!", find_font(), 120, 100, Config()
    )
    assert len(lines) > 1
    assert len(lines) * line_h <= 100
    assert all(font.getlength(l) <= 120 for l in lines)


def test_wrap_splits_unbreakable_word():
    font = load_font(find_font(), 20)
    assert all(font.getlength(l) <= 40 for l in wrap("Supercalifragilistic", font, 40))


def test_layout_box_stays_inside_bubble():
    r = TextRegion((40, 40, 60, 50), "bubble", bubble_box=(0, 0, 100, 100))
    x1, y1, x2, y2 = layout_box(r)
    assert 0 < x1 < 40 and 0 < y1 < 40 and 60 < x2 < 100 and 50 < y2 < 100
