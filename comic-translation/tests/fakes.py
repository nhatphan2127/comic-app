"""Stand-ins for the ML models so tests run without downloads or a GPU."""
from comic_translator.schemas import Detection

BUBBLE = (20, 20, 280, 180)
TEXT = (60, 70, 240, 130)


class FakeDetector:
    def __call__(self, image):
        return [Detection(BUBBLE, "bubble", 0.9), Detection(TEXT, "text_bubble", 0.9)]


class FakeOCR:
    def __init__(self, text="HELLO THERE!"):
        self.text = text

    def read(self, image, box):
        return self.text, 0.9, [box]


class FakeTranslator:
    def __init__(self, reply="Xin chào cậu!"):
        self.reply = reply
        self.calls: list[list[str]] = []

    def translate(self, texts):
        self.calls.append(list(texts))
        return [self.reply for _ in texts]
