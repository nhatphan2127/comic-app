"""Lazily loaded models shared by the graph nodes. Pass fakes in for tests."""
from .config import Config
from .processing.typesetting import find_font


class Services:
    def __init__(self, cfg: Config, *, detector=None, ocr=None, translator=None, fallback_translator=None):
        self.cfg = cfg
        self.device = cfg.resolve_device()
        self.font_path = find_font(cfg.font_path)
        self._detector = detector
        self._ocr = ocr
        self._translator = translator
        self._fallback = fallback_translator

    @property
    def detector(self):
        if self._detector is None:
            from .models.detector import Detector
            self._detector = Detector(self.cfg.detector_model, self.device, self.cfg.detect_threshold)
        return self._detector

    @property
    def ocr(self):
        if self._ocr is None:
            from .models.ocr import OCR
            self._ocr = OCR(self.cfg.ocr_langs, gpu=self.device == "cuda", min_conf=self.cfg.ocr_min_conf)
        return self._ocr

    @property
    def translator(self):
        if self._translator is None:
            from .models.translator import make_translator
            self._translator = make_translator(self.cfg.translator, self.cfg, self.device)
        return self._translator

    @property
    def fallback_translator(self):
        if self._fallback is None and self.cfg.fallback_translator:
            from .models.translator import make_translator
            self._fallback = make_translator(self.cfg.fallback_translator, self.cfg, self.device)
        return self._fallback
