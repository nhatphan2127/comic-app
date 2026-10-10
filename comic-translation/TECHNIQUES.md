# Tổng kết kỹ thuật, kiến trúc và tiêu chuẩn

Tài liệu này liệt kê những gì `comic-translation/` đang dùng, **dùng ở đâu** và **vì sao**.
Cách cài và chạy: [README.md](README.md). Lộ trình: [PLAN.md](PLAN.md).

## Mục lục

1. [Kiến trúc tổng thể](#1-kiến-trúc-tổng-thể)
2. [LangGraph: pipeline dạng state graph](#2-langgraph-pipeline-dạng-state-graph)
3. [Design pattern](#3-design-pattern)
4. [Kỹ thuật theo từng bước xử lý](#4-kỹ-thuật-theo-từng-bước-xử-lý)
5. [Kiểm soát chất lượng bản dịch](#5-kiểm-soát-chất-lượng-bản-dịch)
6. [Kiểm thử](#6-kiểm-thử)
7. [Tiêu chuẩn và quy ước](#7-tiêu-chuẩn-và-quy-ước)
8. [Thư viện, model và giấy phép](#8-thư-viện-model-và-giấy-phép)
9. [Tài liệu tham khảo](#9-tài-liệu-tham-khảo)

---

## 1. Kiến trúc tổng thể

Code chia thành 4 lớp, lớp trên chỉ gọi xuống lớp dưới:

```mermaid
flowchart TD
    cli["cli.py<br/><i>giao diện dòng lệnh</i>"] --> graph
    api["(Phase 4) FastAPI"] -.-> graph
    graph["graph/<br/><i>điều phối: state, node, cạnh</i>"] --> services
    graph --> processing
    services["services.py<br/><i>nạp model lười, inject được</i>"] --> models
    models["models/<br/><i>adapter cho model ML</i>"] --> processing
    processing["processing/ + schemas.py<br/><i>logic thuần, không cần model</i>"]
    config["config.py<br/><i>một dataclass cấu hình</i>"] -.- graph & services & processing
```

| Lớp | Thư mục | Trách nhiệm | Phụ thuộc nặng? |
|---|---|---|---|
| Giao diện | `cli.py`, `__main__.py` | đọc tham số, tạo `Config`, gọi graph cho từng ảnh | không |
| Điều phối | `graph/` | định nghĩa state, các node, các cạnh và điều kiện rẽ nhánh | `langgraph` |
| Dịch vụ | `services.py` | giữ các model, chỉ nạp khi cần lần đầu | không (import trễ) |
| Adapter model | `models/` | bọc RT-DETRv2, EasyOCR, envit5, Ollama thành giao diện đơn giản | `torch`, `transformers`, `easyocr` |
| Logic thuần | `processing/`, `schemas.py` | hình học box, chuẩn hoá chữ, review, xoá chữ, typeset | chỉ `numpy`, `Pillow`, `cv2` |

Hệ quả của cách chia này:

- **Logic thuần test được không cần GPU hay model** (toàn bộ 18 test chạy trong vài giây).
- **Đổi model chỉ đụng `models/`**: ví dụ thay EasyOCR bằng PaddleOCR chỉ cần một class có `read(image, box)`.
- **I/O nằm ở rìa:** chỉ `load` và `save` đụng tới đĩa. Bỏ `image_path`/`output_dir` thì graph chạy hoàn toàn
  trong bộ nhớ, sẵn sàng bọc thành API ở Phase 4.

## 2. LangGraph: pipeline dạng state graph

| Khái niệm | Dùng thế nào | Ở đâu |
|---|---|---|
| `StateGraph` | pipeline là một đồ thị có hướng, compile thành đối tượng chạy được (`invoke`) | `graph/builder.py` |
| State dạng `TypedDict(total=False)` | mọi dữ liệu của một trang: ảnh, danh sách vùng chữ, chỉ số câu bị gắn cờ, số lần thử, ảnh kết quả | `graph/state.py` |
| Node trả về cập nhật một phần | mỗi node chỉ trả các key nó thay đổi; LangGraph gộp vào state | `graph/nodes.py` |
| Conditional edge (router) | `route_after_ocr`: không có chữ thì nhảy thẳng tới `save`; `route_after_review`: còn câu lỗi và còn lượt thì dịch lại | `graph/nodes.py` |
| Vòng lặp có giới hạn | `review ↔ retranslate`, dừng khi hết lỗi hoặc `attempts ≥ max_retries` → không lặp vô hạn | `graph/nodes.py` |
| Tự sinh sơ đồ | `graph.get_graph().draw_mermaid()` → sơ đồ luôn khớp với code | `cli.py --show-graph` |

Đánh đổi có chủ ý: các `TextRegion` được sửa tại chỗ (mutable) rồi trả lại cùng danh sách, thay vì tạo bản sao mới
ở mỗi node. Đơn giản và nhanh hơn, phù hợp vì graph chạy tuần tự, không có node song song.

## 3. Design pattern

| Pattern | Áp dụng | Ở đâu |
|---|---|---|
| **Pipeline / Pipes and Filters** | mỗi bước nhận state, xử lý, chuyển tiếp | toàn bộ `graph/` |
| **State machine** | các node là trạng thái, router quyết định chuyển trạng thái | `graph/builder.py` |
| **Dependency Injection** | `Services(cfg, detector=..., ocr=..., translator=...)`: truyền model giả khi test | `services.py`, `tests/fakes.py` |
| **Lazy initialization** | model chỉ tải ở lần truy cập đầu tiên (`@property`); `import torch` nằm trong hàm → `--show-graph` và test khởi động nhanh | `services.py`, `models/*.py` |
| **Adapter** | bọc API khác nhau của Hugging Face, EasyOCR, Ollama thành giao diện chung | `models/` |
| **Strategy + Factory** | `Translator` là `Protocol` có `translate(texts)`; `make_translator(name)` chọn envit5 hoặc Ollama | `models/translator.py` |
| **Retry có giới hạn + Fallback** | câu bị gắn cờ được dịch lại bằng engine khác, tối đa `max_retries` lần | `graph/nodes.py` |
| **Graceful degradation** | LLM trả sai định dạng → dịch lại từng câu → vẫn sai thì giữ câu gốc (sau đó review gắn cờ) | `OllamaTranslator.translate` |
| **Configuration object** | mọi tham số nằm trong một `@dataclass Config`, có giá trị mặc định và chú thích | `config.py` |
| **Test double (Fake)** | `FakeDetector`, `FakeOCR`, `FakeTranslator` thay model thật | `tests/fakes.py` |

## 4. Kỹ thuật theo từng bước xử lý

### 4.1 Phát hiện vùng chữ (`detect`)

- **RT-DETRv2** (Real-Time DEtection TRansformer) — object detector dạng transformer, dự đoán trực tiếp tập box
  nên không cần NMS. Model `ogkalu/comic-text-and-bubble-detector` được huấn luyện riêng cho truyện tranh,
  có 3 lớp: `bubble`, `text_bubble`, `text_free`. Ngưỡng tin cậy 0.35.
- **Chuẩn hoá nhãn** (`normalize_label`) để không phụ thuộc cách viết tên lớp của model.
- **Loại trùng kiểu greedy NMS** (`dedupe`): sắp theo điểm, bỏ box cùng lớp có IoU ≥ 0.7 với box đã giữ —
  một lớp bảo vệ thêm, rẻ.
- **Gắn vùng chữ vào khung thoại** (`build_regions`): dùng *độ phủ* `diện tích giao / diện tích vùng chữ ≥ 0.5`
  thay vì IoU, vì vùng chữ luôn nhỏ hơn nhiều so với khung thoại chứa nó.
- **Phương án dự phòng:** khung thoại không tìm thấy vùng chữ nào → OCR 80% phần giữa của khung.
- Box dùng định dạng `(x1, y1, x2, y2)` theo pixel tuyệt đối; tiện ích `area`, `intersection`, `iou`,
  `clip_box`, `pad_box` trong `schemas.py`.

### 4.2 Đọc chữ (`read_text`)

- **EasyOCR**: phát hiện dòng chữ bằng CRAFT, nhận dạng bằng CRNN (CNN + BiLSTM + CTC).
- **Phóng to vùng nhỏ:** crop thấp hơn 64 px được phóng bằng nội suy bicubic trước khi OCR, rồi chia lại
  toạ độ để trả box theo trang gốc.
- **Sắp dòng:** gom các mảnh có tâm dọc gần nhau thành một hàng, trong hàng sắp theo x (`sort_lines`).
- **Lọc theo độ tin cậy:** bỏ mảnh có confidence < 0.2.
- **Chuẩn hoá văn bản OCR** (`processing/text.py`):
  - nối từ bị gạch nối khi xuống dòng (`GO-` + `ING` → `GOING`);
  - sửa lỗi OCR hay gặp `|` → `I`; bỏ khoảng trắng thừa trước dấu câu;
  - **IN HOA → kiểu câu** bằng regex: model dịch xử lý chữ in hoa toàn bộ kém. Chỉ áp dụng khi ≥ 80% chữ cái là
    chữ hoa; viết hoa đầu câu và đại từ `I`.
  - **Nhận diện tiếng động (SFX)** bằng heuristic: ≤ 2 từ, phần lớn in hoa, và có chữ lặp ≥ 3 lần (`BOOOM`)
    hoặc là một từ ngắn ≤ 6 ký tự (`KRAK`). SFX ngoài khung thoại bị bỏ qua trừ khi `--translate-sfx`.

### 4.3 Thứ tự đọc (`order`)

- Gom vùng thành **hàng** khi chồng lấn theo chiều dọc > 50% chiều cao của box thấp hơn; hàng sắp trên → dưới,
  trong hàng sắp trái → phải, hoặc phải → trái với `--rtl` (manga).
- Neo theo box của khung thoại (nếu có) thay vì box chữ, cho ổn định hơn.
- Thứ tự này quan trọng vì bộ dịch LLM nhận cả trang **theo đúng thứ tự** làm ngữ cảnh.

### 4.4 Dịch (`translate`)

| | envit5 (mặc định) | Ollama (LLM local) |
|---|---|---|
| Model | `VietAI/envit5-translation` — T5 encoder–decoder (seq2seq) | mặc định `qwen2.5:3b` |
| Cách gọi | `transformers`, batch 8 câu, beam search 4 nhánh, tối đa 256 token | REST `POST /api/chat`, dùng `urllib` của thư viện chuẩn (không thêm dependency) |
| Định dạng | tiền tố `en: ` ở đầu vào, bỏ tiền tố `vi: ` ở đầu ra | **JSON mode** (`format: "json"`) → `{"translations": [...]}` |
| Ngữ cảnh | từng câu độc lập | cả trang theo thứ tự đọc + glossary trong prompt |
| Prompt | — | system prompt quy định: giọng tự nhiên, chọn đại từ (tôi/tao/cậu/anh/em…) nhất quán, câu ngắn vừa khung, giữ tên riêng |
| Kiểm tra đầu ra | — | số phần tử phải bằng số câu gửi đi; sai thì dịch lại từng câu |
| Tham số | — | `temperature 0.3` (ít ngẫu nhiên), timeout 300 s, `stream: false` |

Cả trang được dịch trong **một lần gọi** (batch) thay vì từng khung thoại một: nhanh hơn với envit5,
và cho LLM ngữ cảnh hội thoại.

### 4.5 Xoá chữ gốc (`clean`)

- **Đoán màu nền** = trung vị (median) màu của viền vùng chữ — bền với nhiễu hơn trung bình.
- **Nền phẳng** (độ lệch chuẩn từng kênh màu trên viền < 25) và là khung thoại → tìm pixel chữ
  (tổng chênh lệch RGB với nền > 60), **giãn nở (dilation)** mặt nạ 2 lần theo 4 hướng (viết bằng numpy),
  rồi tô bằng màu nền. Nhanh, sạch, không làm nhoè.
- **Nền phức tạp** → **inpainting Telea** của OpenCV (thuật toán Fast Marching Method) trên mặt nạ là các
  box dòng OCR, chỉ xử lý một cửa sổ nhỏ quanh vùng chữ (lề 12 px) để nhanh.
- Màu nền được lưu vào `region.bg_color` để bước typeset chọn màu chữ.

### 4.6 Chèn chữ tiếng Việt (`typeset`)

- **Vùng đặt chữ:** khung thoại thường là hình elip → dùng hình chữ nhật nội tiếp ~72% kích thước khung
  (hình chữ nhật diện tích lớn nhất nội tiếp elip có cạnh = 1/√2 ≈ 70.7% trục), gộp với box chữ gốc,
  rồi kẹp vào trong khung với lề 4 px.
- **Ngắt dòng tham lam (greedy word wrap)** đo bằng độ rộng thật của font (`font.getlength`);
  từ dài hơn cả dòng thì cắt theo ký tự kèm dấu `-`.
- **Tìm nhị phân cỡ chữ** trong khoảng [10, min(48, chiều cao vùng)] để được cỡ **lớn nhất** vừa khung —
  O(log n) lần thử thay vì thử từng cỡ. Font đã nạp được cache bằng `functools.lru_cache`.
- **Unicode NFC:** chuẩn hoá bản dịch về dạng dựng sẵn để dấu tiếng Việt (ví dụ `ệ`) hiển thị đúng một glyph.
- **Giãn dòng 1.25** — chữ tiếng Việt có dấu trên và dưới nên cần nhiều khoảng hơn tiếng Anh.
- **Màu chữ tương phản:** tính độ sáng nền theo hệ số ITU-R BT.601 (0.299 R + 0.587 G + 0.114 B);
  nền tối → chữ trắng, nền sáng → chữ đen. Chữ ngoài khung thoại có thêm viền (stroke) để dễ đọc trên nền ảnh.
- Căn giữa từng dòng bằng `anchor="mm"` của Pillow.

### 4.7 Ghi kết quả (`save`)

- Ảnh PNG + JSON chi tiết (UTF-8, `ensure_ascii=False` để giữ nguyên chữ Việt, thụt lề 2).
- JSON lưu cả chữ gốc, chữ đã chuẩn hoá, bản dịch, box, lỗi → dùng để soát lỗi và sau này làm
  **dữ liệu song ngữ để fine-tune** (Phase 5).
- Ảnh debug vẽ box theo màu loại vùng và thứ tự đọc.

## 5. Kiểm soát chất lượng bản dịch

Bước `review` là bộ **kiểm tra theo luật (rule-based QA)**, không cần model, chạy sau mỗi lần dịch:

| Mã lỗi | Điều kiện | Bắt được gì |
|---|---|---|
| `empty` | bản dịch rỗng | model không trả gì |
| `untranslated` | câu nguồn ≥ 2 từ và bản dịch giống hệt câu nguồn (không phân biệt hoa thường) | model chép lại tiếng Anh |
| `too_long` | độ dài bản dịch > 3 × câu nguồn + 10 ký tự | **hallucination**: model bịa thêm |
| `repetition` | một từ lặp liên tiếp ≥ 4 lần (regex `\b(\w+)(?:\W+\1\b){3,}`) | lỗi lặp vô tận của seq2seq |

Kết hợp với vòng `retranslate` tạo thành cơ chế **tự sửa (self-correction) có giới hạn**: câu lỗi được dịch lại
bằng engine khác; câu vẫn lỗi sau cùng được đánh dấu `needs_review` để **con người xem lại**
(human-in-the-loop) thay vì im lặng cho qua.

## 6. Kiểm thử

- **pytest**, 18 test, chạy không cần model/GPU/mạng nhờ fake trong `tests/fakes.py`.
- **Unit test** cho logic thuần: hình học box và thứ tự đọc (`test_regions.py`), chuẩn hoá chữ, SFX, review
  (`test_text.py`), xoá chữ, ngắt dòng, cỡ chữ, vùng đặt chữ (`test_rendering.py`).
- **Integration test** cho cả graph (`test_graph.py`): ghi đủ file, chạy trong bộ nhớ không ghi đĩa,
  trang không có chữ bỏ qua bước dịch, câu bị gắn cờ đi tới fallback, số lần thử bị giới hạn.
- Cấu hình ở `pyproject.toml` (`[tool.pytest.ini_options]`: `pythonpath = ["src"]`) nên chạy được cả khi chưa
  `pip install`.

## 7. Tiêu chuẩn và quy ước

### Đóng gói Python

| Chuẩn | Áp dụng |
|---|---|
| **PEP 621** | metadata dự án khai báo trong `[project]` của `pyproject.toml` |
| **PEP 517 / 518** | build backend `setuptools.build_meta` khai báo trong `[build-system]` |
| **src layout** | code nằm trong `src/comic_translator/`, tách khỏi thư mục gốc → không vô tình import nhầm code chưa cài, ranh giới package rõ ràng |
| **PEP 660** | cài chế độ editable `pip install -e ".[dev]"` |
| Optional dependencies | nhóm `dev` (pytest) tách khỏi phụ thuộc chạy |
| Entry point `console_scripts` | lệnh `comic-translate` → `comic_translator.cli:main` |
| `__main__.py` | chạy được bằng `python -m comic_translator` |
| Semantic Versioning | phiên bản `0.1.0` (0.x = API chưa ổn định) |

### Kiểu dữ liệu và code

| Chuẩn | Áp dụng |
|---|---|
| **PEP 484** type hints | mọi hàm public đều có kiểu |
| **PEP 585 / PEP 604** | `list[str]`, `str \| None` → lý do yêu cầu Python ≥ 3.10 |
| **PEP 557** `dataclass` | `Config`, `Detection`, `TextRegion` |
| **PEP 589** `TypedDict` | `PageState` |
| **PEP 544** `Protocol` | `Translator` — kiểu cấu trúc (duck typing có kiểm tra), không cần kế thừa |
| **PEP 8** | đặt tên, bố cục; mỗi module có docstring nói rõ vai trò |

### Dữ liệu, văn bản, giao tiếp

| Chuẩn | Áp dụng |
|---|---|
| **UTF-8** | đọc glossary, ghi JSON |
| **Unicode NFC** (UAX #15) | chuẩn hoá chữ Việt trước khi vẽ |
| **JSON** (RFC 8259) | file kết quả `_vi.json`, glossary, giao tiếp với Ollama |
| **ITU-R BT.601** | công thức độ sáng để chọn màu chữ |
| REST/HTTP | Ollama `POST /api/chat` |
| Hugging Face Hub | model tham chiếu bằng ID `tổ-chức/tên-model`, tải và cache tự động |
| Mã thoát CLI | `0` thành công, `1` lỗi dữ liệu vào, `2` dùng sai lệnh (giống quy ước của `argparse`) |
| Mermaid | sơ đồ trong tài liệu dạng văn bản (docs-as-code), render trực tiếp trên GitHub |

### Chỉ số đánh giá (dự kiến, xem [PLAN.md](PLAN.md#đánh-giá))

Recall phát hiện khung thoại, **CER** (Character Error Rate) cho OCR, đánh giá thủ công bản dịch,
so sánh hình ảnh trước/sau.

## 8. Thư viện, model và giấy phép

| Thành phần | Vai trò | Giấy phép |
|---|---|---|
| LangGraph | điều phối pipeline | MIT |
| PyTorch | chạy model trên GPU (CUDA) / CPU | BSD-3-Clause |
| Hugging Face Transformers | nạp RT-DETRv2 và envit5 | Apache-2.0 |
| EasyOCR | OCR | Apache-2.0 |
| OpenCV (`opencv-python-headless`) | resize, inpainting | Apache-2.0 |
| Pillow | đọc/ghi ảnh, vẽ chữ | MIT-CMU (HPND) |
| NumPy | xử lý mảng pixel | BSD-3-Clause |
| `ogkalu/comic-text-and-bubble-detector` | model detect | Apache-2.0 |
| `VietAI/envit5-translation` | model dịch | OpenRAIL (có điều khoản sử dụng có trách nhiệm) |
| Ollama + Qwen | LLM local | Ollama: MIT; Qwen2.5-3B: Qwen Research License — kiểm tra trước khi dùng thương mại |
| ~~NLLB-200~~ | không dùng | CC-BY-NC — cấm thương mại |

Bản `-headless` của OpenCV được chọn vì không cần cửa sổ GUI, nhẹ hơn và chạy được trên server.

## 9. Tài liệu tham khảo

- RT-DETR: Zhao et al., *DETRs Beat YOLOs on Real-time Object Detection*, CVPR 2024.
  RT-DETRv2: Lv et al., *RT-DETRv2: Improved Baseline with Bag-of-Freebies for Real-Time Detection Transformer*, 2024.
- CRAFT: Baek et al., *Character Region Awareness for Text Detection*, CVPR 2019.
- CRNN: Shi et al., *An End-to-End Trainable Neural Network for Image-based Sequence Recognition*, TPAMI 2017.
- T5: Raffel et al., *Exploring the Limits of Transfer Learning with a Unified Text-to-Text Transformer*, JMLR 2020.
- envit5 / MTet: Ngo et al., *MTet: Multi-domain Translation for English and Vietnamese*, 2022.
- Telea, *An Image Inpainting Technique Based on the Fast Marching Method*, Journal of Graphics Tools, 2004.
- LaMa (dự kiến Phase 3): Suvorov et al., *Resolution-robust Large Mask Inpainting with Fourier Convolutions*, WACV 2022.
- LangGraph: <https://langchain-ai.github.io/langgraph/>
