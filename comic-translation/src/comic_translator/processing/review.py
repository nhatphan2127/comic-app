"""Cheap sanity checks on machine translations (no model needed)."""
import re

from ..config import Config

_REPEAT = re.compile(r"\b(\w+)(?:\W+\1\b){3,}", re.IGNORECASE)


def find_issue(source: str, translation: str, cfg: Config) -> str | None:
    """Return a short reason if the translation looks wrong, else None."""
    t = translation.strip()
    if not t:
        return "empty"
    if len(source.split()) >= 2 and t.lower() == source.strip().lower():
        return "untranslated"
    if len(t) > cfg.max_length_ratio * len(source) + 10:
        return "too_long"
    if _REPEAT.search(t):
        return "repetition"
    return None
