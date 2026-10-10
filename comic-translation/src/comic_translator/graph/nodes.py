"""Graph nodes: each takes the page state and returns the keys it updates."""
import json
from pathlib import Path

import numpy as np
from PIL import Image

from ..config import Config
from ..processing.cleaning import clean_region
from ..processing.regions import build_regions, reading_order
from ..processing.review import find_issue
from ..processing.text import looks_like_sfx, to_sentence_case
from ..processing.typesetting import draw_region
from ..processing.visualize import draw_debug
from ..schemas import TextRegion
from ..services import Services
from .state import PageState


class PageNodes:
    def __init__(self, cfg: Config, services: Services):
        self.cfg = cfg
        self.services = services

    # --- nodes ------------------------------------------------------------

    def load(self, state: PageState) -> PageState:
        image = state["image"] if "image" in state else Image.open(state["image_path"])
        return {"image": image.convert("RGB"), "attempts": 0, "flagged": []}

    def detect(self, state: PageState) -> PageState:
        detections = self.services.detector(state["image"])
        return {"regions": build_regions(detections, self.cfg.free_text)}

    def read_text(self, state: PageState) -> PageState:
        pixels = np.asarray(state["image"])
        regions = state["regions"]
        for r in regions:
            r.text, r.ocr_conf, r.lines = self.services.ocr.read(pixels, r.box)
            r.source = to_sentence_case(r.text)
        return {"regions": [r for r in regions if self._worth_translating(r)]}

    def order(self, state: PageState) -> PageState:
        return {"regions": reading_order(state["regions"], self.cfg.rtl)}

    def translate(self, state: PageState) -> PageState:
        regions = state["regions"]
        for r, t in zip(regions, self.services.translator.translate([r.source for r in regions])):
            r.translation = t
        return {"regions": regions}

    def review(self, state: PageState) -> PageState:
        regions = state["regions"]
        for r in regions:
            r.issue = find_issue(r.source, r.translation, self.cfg)
        return {"flagged": [i for i, r in enumerate(regions) if r.issue]}

    def retranslate(self, state: PageState) -> PageState:
        regions = state["regions"]
        flagged = [regions[i] for i in state["flagged"]]
        for r, t in zip(flagged, self.services.fallback_translator.translate([r.source for r in flagged])):
            r.translation = t
        return {"regions": regions, "attempts": state.get("attempts", 0) + 1}

    def clean(self, state: PageState) -> PageState:
        pixels = np.array(state["image"])
        for r in state["regions"]:
            clean_region(pixels, r)
        return {"rendered": Image.fromarray(pixels)}

    def typeset(self, state: PageState) -> PageState:
        rendered = state["rendered"]
        for r in state["regions"]:
            draw_region(rendered, r, self.cfg, self.services.font_path)
        return {"rendered": rendered}

    def save(self, state: PageState) -> PageState:
        rendered = state["rendered"] if "rendered" in state else state["image"]
        if not state.get("output_dir"):
            return {"rendered": rendered, "outputs": {}}

        out_dir = Path(state["output_dir"])
        out_dir.mkdir(parents=True, exist_ok=True)
        stem = Path(state.get("image_path", "page")).stem
        regions = state.get("regions", [])
        outputs = {"image": out_dir / f"{stem}_vi.png", "json": out_dir / f"{stem}_vi.json"}

        rendered.save(outputs["image"])
        meta = {
            "source": state.get("image_path"),
            "size": state["image"].size,
            "needs_review": [r.order for r in regions if r.issue],
            "regions": [r.to_dict() for r in regions],
        }
        outputs["json"].write_text(json.dumps(meta, ensure_ascii=False, indent=2), "utf-8")
        if self.cfg.debug:
            outputs["debug"] = out_dir / f"{stem}_debug.png"
            draw_debug(state["image"], regions).save(outputs["debug"])
        return {"rendered": rendered, "outputs": {k: str(v) for k, v in outputs.items()}}

    # --- routers ------------------------------------------------------------

    def route_after_ocr(self, state: PageState) -> str:
        return "order" if state["regions"] else "save"

    def route_after_review(self, state: PageState) -> str:
        can_retry = self.cfg.fallback_translator and state.get("attempts", 0) < self.cfg.max_retries
        return "retranslate" if state["flagged"] and can_retry else "clean"

    # --- helpers --------------------------------------------------------------

    def _worth_translating(self, r: TextRegion) -> bool:
        if not any(c.isalpha() for c in r.text):
            return False
        return not (r.kind == "free" and not self.cfg.translate_sfx and looks_like_sfx(r.text))
