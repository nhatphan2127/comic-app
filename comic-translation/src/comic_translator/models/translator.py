"""Step 4: English -> Vietnamese."""
import json
import urllib.request
from typing import Protocol

from ..config import Config


class Translator(Protocol):
    def translate(self, texts: list[str]) -> list[str]: ...


class EnviT5Translator:
    """VietAI/envit5-translation: inputs prefixed 'en: ', outputs prefixed 'vi: '."""

    def __init__(self, model_id: str, device: str, batch_size: int = 8):
        from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

        self.tokenizer = AutoTokenizer.from_pretrained(model_id)
        self.model = AutoModelForSeq2SeqLM.from_pretrained(model_id).to(device).eval()
        self.device = device
        self.batch_size = batch_size

    def translate(self, texts: list[str]) -> list[str]:
        import torch

        out: list[str] = []
        for i in range(0, len(texts), self.batch_size):
            batch = [f"en: {t}" for t in texts[i : i + self.batch_size]]
            enc = self.tokenizer(batch, return_tensors="pt", padding=True, truncation=True, max_length=256)
            with torch.no_grad():
                gen = self.model.generate(**enc.to(self.device), max_length=256, num_beams=4)
            out += [strip_prefix(s) for s in self.tokenizer.batch_decode(gen, skip_special_tokens=True)]
        return out


def strip_prefix(s: str) -> str:
    s = s.strip()
    return s[3:].strip() if s.lower().startswith("vi:") else s


SYSTEM_PROMPT = """You translate English comic dialogue into natural, casual Vietnamese.
Rules:
- The lines are in reading order on one page; use them as context for each other.
- Pick Vietnamese pronouns (tôi/tao/tớ/anh/em/cậu/mày...) that fit the speakers and keep them consistent.
- Keep it short: the text must fit back into the same speech bubble.
- Keep names untranslated unless the glossary says otherwise.
- Reply ONLY with JSON: {"translations": ["...", ...]} with exactly one entry per input line, same order."""


class OllamaTranslator:
    """Local LLM through Ollama: better tone and context, slower."""

    def __init__(self, url: str, model: str, glossary: dict[str, str] | None = None):
        self.url = url.rstrip("/") + "/api/chat"
        self.model = model
        self.glossary = glossary or {}

    def _chat(self, user: str) -> str:
        body = {
            "model": self.model,
            "stream": False,
            "format": "json",
            "options": {"temperature": 0.3},
            "messages": [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": user}],
        }
        req = urllib.request.Request(self.url, json.dumps(body).encode(), {"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=300) as resp:
            return json.load(resp)["message"]["content"]

    def _request(self, texts: list[str]) -> list[str] | None:
        lines = "\n".join(f"{i + 1}. {t}" for i, t in enumerate(texts))
        glossary = "\n".join(f"{k} -> {v}" for k, v in self.glossary.items())
        user = (f"Glossary:\n{glossary}\n\n" if glossary else "") + f"Lines ({len(texts)}):\n{lines}"
        try:
            result = json.loads(self._chat(user)).get("translations")
        except (json.JSONDecodeError, AttributeError):
            return None
        if isinstance(result, list) and len(result) == len(texts):
            return [str(t).strip() for t in result]
        return None

    def translate(self, texts: list[str]) -> list[str]:
        if not texts:
            return []
        result = self._request(texts)
        if result is None:  # model broke the format: fall back to one line at a time
            result = [(self._request([t]) or [t])[0] for t in texts]
        return result


def make_translator(name: str, cfg: Config, device: str) -> Translator:
    if name == "envit5":
        return EnviT5Translator(cfg.envit5_model, device)
    if name == "ollama":
        return OllamaTranslator(cfg.ollama_url, cfg.ollama_model, cfg.glossary)
    raise ValueError(f"unknown translator: {name}")
