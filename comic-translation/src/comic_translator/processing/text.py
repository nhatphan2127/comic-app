"""Clean OCR output before translation."""
import re

_SENTENCE_START = re.compile(r"(^|[.!?]\s+|\.\.\.\s*)([a-z])")
_LONE_I = re.compile(r"\b(i)(?=\b|')")


def normalize_ocr(lines: list[str]) -> str:
    """Join OCR lines into one string, undoing hyphenated line breaks."""
    out = ""
    for line in (l.strip() for l in lines):
        if not line:
            continue
        if out.endswith("-") and line[:1].isalpha():
            out = out[:-1] + line
        else:
            out = f"{out} {line}" if out else line
    out = out.replace(" | ", " I ").replace("|", "I")
    out = re.sub(r"\s+([,.!?…])", r"\1", out)
    return re.sub(r"\s+", " ", out).strip()


def is_mostly_upper(text: str, ratio: float = 0.8) -> bool:
    letters = [c for c in text if c.isalpha()]
    return bool(letters) and sum(c.isupper() for c in letters) / len(letters) >= ratio


def to_sentence_case(text: str) -> str:
    """Comic lettering is ALL CAPS, which MT models handle poorly."""
    if not is_mostly_upper(text):
        return text
    s = text.lower()
    s = _SENTENCE_START.sub(lambda m: m.group(1) + m.group(2).upper(), s)
    return _LONE_I.sub("I", s)


def looks_like_sfx(text: str) -> bool:
    """Heuristic for sound effects: BOOM!, KRAKKK, WHAM!!"""
    words = re.findall(r"[A-Za-z]+", text)
    if not words or len(words) > 2:
        return False
    word = words[0]
    stretched = re.search(r"(.)\1\1", word.lower()) is not None
    return is_mostly_upper(text) and (stretched or len(words) == 1 and len(word) <= 6)
