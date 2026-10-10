from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]  # comic-translation/


@dataclass
class Config:
    device: str = "auto"  # auto | cuda | cpu

    # 1. detection
    detector_model: str = "ogkalu/comic-text-and-bubble-detector"
    detect_threshold: float = 0.35
    free_text: bool = False  # Phase 3: also handle text outside bubbles

    # 2. OCR
    ocr_langs: tuple[str, ...] = ("en",)
    ocr_min_conf: float = 0.2

    # 3. ordering
    rtl: bool = False  # True for manga (right-to-left)

    # 4. translation
    translator: str = "envit5"  # envit5 | ollama
    envit5_model: str = "VietAI/envit5-translation"
    ollama_url: str = "http://localhost:11434"
    ollama_model: str = "qwen2.5:3b"
    glossary: dict[str, str] = field(default_factory=dict)
    translate_sfx: bool = False
    # review loop: lines flagged by the reviewer are re-translated by this engine
    fallback_translator: str | None = None  # e.g. "ollama"; None disables retries
    max_retries: int = 1
    max_length_ratio: float = 3.0  # VI longer than 3x the EN source looks like a hallucination

    # 6. typesetting
    font_path: str | None = None
    uppercase: bool = False
    min_font_size: int = 10
    max_font_size: int = 48
    line_spacing: float = 1.25  # Vietnamese diacritics need extra room

    # output
    debug: bool = False

    def resolve_device(self) -> str:
        if self.device != "auto":
            return self.device
        try:
            import torch
            return "cuda" if torch.cuda.is_available() else "cpu"
        except ImportError:
            return "cpu"
