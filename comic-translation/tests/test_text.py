from comic_translator.config import Config
from comic_translator.models.translator import strip_prefix
from comic_translator.processing.review import find_issue
from comic_translator.processing.text import looks_like_sfx, normalize_ocr, to_sentence_case


def test_normalize_ocr_joins_hyphenated_lines():
    assert normalize_ocr(["WHERE ARE YOU GO-", "ING , JOHN ?"]) == "WHERE ARE YOU GOING, JOHN?"


def test_sentence_case():
    assert to_sentence_case("I DON'T KNOW. WHERE IS HE?") == "I don't know. Where is he?"
    assert to_sentence_case("Already mixed Case") == "Already mixed Case"


def test_sfx():
    assert looks_like_sfx("BOOOM!")
    assert looks_like_sfx("KRAK")
    assert not looks_like_sfx("WE NEED TO LEAVE NOW!")


def test_strip_prefix():
    assert strip_prefix("vi: Xin chào") == "Xin chào"
    assert strip_prefix("Xin chào") == "Xin chào"


def test_review_rules():
    cfg = Config()
    assert find_issue("Hello there!", "Xin chào!", cfg) is None
    assert find_issue("Hello there!", "  ", cfg) == "empty"
    assert find_issue("Hello there!", "hello there!", cfg) == "untranslated"
    assert find_issue("Hi", "x" * 50, cfg) == "too_long"
    assert find_issue("No no no no no", "không không không không không", cfg) == "repetition"
