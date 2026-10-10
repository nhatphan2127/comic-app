"""
Page translation graph:

    load → detect → read_text ─(no text)──────────────────────────→ save
                        │
                        └→ order → translate → review ─(ok)→ clean → typeset → save
                                                 ↑   │
                                                 │ (flagged, retries left)
                                              retranslate
"""
from langgraph.graph import END, START, StateGraph

from ..config import Config
from ..services import Services
from .nodes import PageNodes
from .state import PageState


def build_graph(cfg: Config, services: Services | None = None):
    nodes = PageNodes(cfg, services or Services(cfg))
    g = StateGraph(PageState)

    for name in ("load", "detect", "read_text", "order", "translate", "review", "retranslate", "clean", "typeset", "save"):
        g.add_node(name, getattr(nodes, name))

    g.add_edge(START, "load")
    g.add_edge("load", "detect")
    g.add_edge("detect", "read_text")
    g.add_conditional_edges("read_text", nodes.route_after_ocr, ["order", "save"])
    g.add_edge("order", "translate")
    g.add_edge("translate", "review")
    g.add_conditional_edges("review", nodes.route_after_review, ["retranslate", "clean"])
    g.add_edge("retranslate", "review")
    g.add_edge("clean", "typeset")
    g.add_edge("typeset", "save")
    g.add_edge("save", END)
    return g.compile()
