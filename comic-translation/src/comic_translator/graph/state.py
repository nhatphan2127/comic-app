from typing import TypedDict

from PIL import Image

from ..schemas import TextRegion


class PageState(TypedDict, total=False):
    # input: either a path to load, or an image already in memory (API use)
    image_path: str
    image: Image.Image
    output_dir: str  # if omitted, nothing is written to disk

    regions: list[TextRegion]
    flagged: list[int]  # indices into `regions` the reviewer rejected
    attempts: int  # re-translation rounds done so far

    rendered: Image.Image
    outputs: dict[str, str]  # kind -> written file path
