"""Text / speech-bubble detector (RT-DETR)."""
from PIL import Image

from ..processing.regions import dedupe
from ..schemas import Detection


def normalize_label(raw: str) -> str:
    name = raw.lower().replace("-", "_").replace(" ", "_")
    if "free" in name:
        return "text_free"
    if "text" in name:
        return "text_bubble"
    if "bubble" in name or "balloon" in name:
        return "bubble"
    return name


class Detector:
    """`ogkalu/comic-text-and-bubble-detector` — classes: bubble, text_bubble, text_free."""

    def __init__(self, model_id: str, device: str, threshold: float = 0.35):
        import torch
        from transformers import AutoImageProcessor, AutoModelForObjectDetection

        self.torch = torch
        self.device = device
        self.threshold = threshold
        self.processor = AutoImageProcessor.from_pretrained(model_id)
        self.model = AutoModelForObjectDetection.from_pretrained(model_id).to(device).eval()

    def __call__(self, image: Image.Image) -> list[Detection]:
        torch = self.torch
        inputs = self.processor(images=image, return_tensors="pt").to(self.device)
        with torch.no_grad():
            outputs = self.model(**inputs)
        result = self.processor.post_process_object_detection(
            outputs, target_sizes=torch.tensor([(image.height, image.width)]), threshold=self.threshold
        )[0]
        id2label = self.model.config.id2label
        detections = []
        for score, label, box in zip(result["scores"], result["labels"], result["boxes"]):
            x1, y1, x2, y2 = (int(round(v)) for v in box.tolist())
            detections.append(Detection((x1, y1, x2, y2), normalize_label(id2label[int(label)]), float(score)))
        return dedupe(detections)
