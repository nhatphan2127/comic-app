"""CLI: comic-translate data/samples -o outputs --debug"""
import argparse
import json
import sys
from pathlib import Path

from .config import Config

IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp"}


def collect_inputs(path: Path) -> list[Path]:
    if path.is_dir():
        return sorted(p for p in path.iterdir() if p.suffix.lower() in IMAGE_EXTS)
    return [path] if path.is_file() else []


def parse_args(argv: list[str] | None) -> argparse.Namespace:
    p = argparse.ArgumentParser(prog="comic-translate", description="Translate English comic pages to Vietnamese.")
    p.add_argument("input", type=Path, nargs="?", help="image file or folder of pages")
    p.add_argument("-o", "--out", type=Path, default=Path("outputs"))
    p.add_argument("--translator", choices=["envit5", "ollama"], default="envit5")
    p.add_argument("--fallback", choices=["envit5", "ollama"], help="re-translate lines the reviewer flags")
    p.add_argument("--ollama-model", default=Config.ollama_model)
    p.add_argument("--glossary", type=Path, help='JSON {"English name": "Vietnamese"} (ollama only for now)')
    p.add_argument("--free-text", action="store_true", help="also translate text outside bubbles")
    p.add_argument("--translate-sfx", action="store_true")
    p.add_argument("--rtl", action="store_true", help="right-to-left reading order (manga)")
    p.add_argument("--uppercase", action="store_true", help="typeset in ALL CAPS")
    p.add_argument("--font", help="path to a .ttf/.otf with Vietnamese glyphs")
    p.add_argument("--device", choices=["auto", "cuda", "cpu"], default="auto")
    p.add_argument("--debug", action="store_true", help="also save an image with detected boxes")
    p.add_argument("--show-graph", action="store_true", help="print the pipeline as a Mermaid diagram and exit")
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    cfg = Config(
        device=args.device,
        free_text=args.free_text,
        translate_sfx=args.translate_sfx,
        rtl=args.rtl,
        translator=args.translator,
        fallback_translator=args.fallback,
        ollama_model=args.ollama_model,
        glossary=json.loads(args.glossary.read_text("utf-8")) if args.glossary else {},
        font_path=args.font,
        uppercase=args.uppercase,
        debug=args.debug,
    )

    from .graph import build_graph

    graph = build_graph(cfg)  # models load lazily, so this is cheap
    if args.show_graph:
        print(graph.get_graph().draw_mermaid())
        return 0

    if args.input is None:
        print("error: input is required", file=sys.stderr)
        return 2
    inputs = collect_inputs(args.input)
    if not inputs:
        print(f"no images found at {args.input}", file=sys.stderr)
        return 1

    for path in inputs:
        state = graph.invoke({"image_path": str(path), "output_dir": str(args.out)})
        flagged = sum(1 for r in state.get("regions", []) if r.issue)
        note = f"  ({flagged} line(s) need review)" if flagged else ""
        print(f"{path.name} -> {state['outputs']['image']}{note}")
    return 0
