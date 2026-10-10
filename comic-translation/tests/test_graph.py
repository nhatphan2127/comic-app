"""End-to-end runs of the LangGraph pipeline with fake models."""
import json

import numpy as np
import pytest
from PIL import Image, ImageDraw

from comic_translator import Config, Services, build_graph
from fakes import BUBBLE, FakeDetector, FakeOCR, FakeTranslator


@pytest.fixture
def page(tmp_path):
    img = Image.new("RGB", (300, 200), "white")
    draw = ImageDraw.Draw(img)
    draw.ellipse(BUBBLE, outline="black", width=3)
    draw.rectangle((70, 90, 230, 110), fill="black")  # stand-in for English lettering
    path = tmp_path / "page.png"
    img.save(path)
    return path


def make_graph(cfg=None, ocr=None, translator=None, fallback=None):
    cfg = cfg or Config()
    services = Services(
        cfg, detector=FakeDetector(), ocr=ocr or FakeOCR(),
        translator=translator or FakeTranslator(), fallback_translator=fallback,
    )
    return build_graph(cfg, services)


def test_translates_and_writes_outputs(page, tmp_path):
    translator = FakeTranslator()
    graph = make_graph(Config(debug=True), translator=translator)
    state = graph.invoke({"image_path": str(page), "output_dir": str(tmp_path / "out")})

    assert translator.calls == [["Hello there!"]]  # sentence-cased before translation
    assert set(state["outputs"]) == {"image", "json", "debug"}
    meta = json.loads((tmp_path / "out" / "page_vi.json").read_text("utf-8"))
    assert meta["regions"][0]["translation"] == "Xin chào cậu!"
    assert meta["needs_review"] == []

    result = np.asarray(Image.open(state["outputs"]["image"]))
    assert (result[90:111, 70:231] < 50).mean() < 0.6  # solid bar erased, only glyph strokes remain
    assert result[60:140, 60:240].min() < 100  # new text drawn
    assert result[100, 21].max() < 100  # bubble outline kept


def test_in_memory_page_writes_nothing(page):
    state = make_graph().invoke({"image": Image.open(page)})
    assert state["outputs"] == {}
    assert state["rendered"].size == (300, 200)


def test_page_without_text_skips_translation(page):
    translator = FakeTranslator()
    state = make_graph(ocr=FakeOCR(text="..."), translator=translator).invoke({"image_path": str(page)})
    assert translator.calls == []
    assert state["regions"] == []


def test_flagged_line_goes_to_fallback(page):
    bad, good = FakeTranslator(reply=""), FakeTranslator(reply="Chào!")
    cfg = Config(fallback_translator="fake")
    state = make_graph(cfg, translator=bad, fallback=good).invoke({"image_path": str(page)})
    assert good.calls == [["Hello there!"]]
    assert state["attempts"] == 1
    assert state["regions"][0].translation == "Chào!"
    assert state["regions"][0].issue is None


def test_retries_are_bounded(page):
    bad = FakeTranslator(reply="")
    cfg = Config(fallback_translator="fake", max_retries=2)
    state = make_graph(cfg, translator=bad, fallback=bad).invoke({"image_path": str(page)})
    assert state["attempts"] == 2
    assert state["regions"][0].issue == "empty"  # left for human review
