# Publishing API

Cho contributor tạo truyện và đăng chapter **bằng script** thay vì form trong Studio.

- Hướng dẫn cho người dùng: Studio → **API guide** (`/studio/api-guide`).
- Script mẫu: `inkverse.py` (Python + `requests`) và `inkverse.mjs` (Node 20+, không cần thư viện),
  hiển thị và tải về từ trang API guide; mã nguồn nằm ở
  [frontend/src/features/studio/api-guide/scripts.ts](../../frontend/src/features/studio/api-guide/scripts.ts).
- Chi tiết từng field: `src/docs/openapi.yaml` (tag *Publishing*) và Swagger UI tại `/api/docs`.

## 1. Endpoint

| Method | Path | Xác thực | Mục đích |
|---|---|---|---|
| GET | `/api/v1/publish/whoami` | API key | kiểm tra key, xem key thuộc về ai |
| POST | `/api/v1/publish/comics` | API key, scope `comics:write` | tạo truyện (multipart, file `cover`) |
| POST | `/api/v1/publish/comics/{comic}/chapters` | API key, scope `chapters:write` | đăng chapter (multipart, các file `pages` theo thứ tự); `{comic}` = id hoặc slug |
| POST | `/api/v1/publish/bulk` | API key, scope `bulk:write` (chỉ admin) | nhập cả thư viện từ một file zip (multipart, file `archive`) |
| GET / POST | `/api/v1/me/api-keys` | phiên đăng nhập (cookie) | liệt kê / tạo key (tạo key phải nhập lại mật khẩu) |
| DELETE | `/api/v1/me/api-keys/{keyId}` | phiên đăng nhập (cookie) | thu hồi key |

Gửi key bằng header `Authorization: Bearer ink_...`.

## 2. Nhập hàng loạt (admin)

Admin tạo key có scope `bulk:write` (Studio → API keys → *Bulk import*; scope này không bao giờ nằm trong
scope mặc định và bị từ chối với người không phải admin), rồi gửi cả thư viện trong một file zip:

```
library.zip
└── One Piece/                     thư mục nào có comic.json là một truyện, ở bất kỳ độ sâu nào
    ├── comic.json                 cùng các field như POST /publish/comics ("genres" có thể là mảng)
    ├── cover.jpg                  chỉ cần khi truyện chưa có
    ├── Chapter 1 - Romance Dawn/  số đầu tiên = số chapter, phần sau " - " = tiêu đề
    │   ├── 001.jpg                các trang sắp theo thứ tự tự nhiên (2.jpg trước 10.jpg)
    │   └── 002.jpg
    └── Chapter 2/
```

```bash
curl -H "Authorization: Bearer $INKVERSE_API_KEY" -F archive=@library.zip http://localhost:5000/api/v1/publish/bulk
```

Cấu trúc thư mục giống hệt cái script mẫu dùng, nên thư mục chuẩn bị cho script có thể nén zip và gửi luôn.
Kết quả là `200` với `summary` (số lượng) và một mục cho mỗi truyện, mỗi chapter: `created`, `existing`
(truyện đã có), `skipped` (chapter đã có, hoặc không có ảnh) hoặc `failed` kèm `httpStatus` và `reason`.

- **Chạy lại được.** Truyện được nhận diện theo `id` trong `comic.json`, nếu không có thì theo `url`
  (hoặc slug sinh từ `name`). Truyện đã có thì nhận thêm chapter chứ không tạo lại; số chapter đã có bị bỏ qua
  trước khi giải nén. Lỗi giữa chừng thì sửa thư mục rồi gửi lại đúng file zip đó.
- **Mỗi mục độc lập.** Mỗi truyện, mỗi chapter được tạo trong transaction riêng qua `publishService`, tức là
  cùng kiểm tra dữ liệu và kiểm duyệt như khi đăng từng cái (`pending` trừ khi admin bật tự duyệt).
  Mục lỗi tự xoá file của nó; các mục khác giữ nguyên. Chỉ lỗi bất ngờ (DB, ổ đĩa) mới dừng cả lần nhập.
- **Kiểm tra trước khi giải nén.** Số entry, kích thước khai báo, tên đường dẫn (yauzl từ chối đường dẫn tuyệt
  đối và `..`), rồi đến byte đầu của từng ảnh. File lưu với tên ngẫu nhiên và đuôi theo loại thật của nó.
  File zip nằm trong thư mục tạm của hệ điều hành, không bao giờ nằm dưới `/storage`, và bị xoá khi request xong.

## 3. Thiết kế bảo mật

| Rủi ro | Cách giảm thiểu |
|---|---|
| Lộ key từ database | Chỉ lưu `SHA-256(key)`. Key là 256 bit ngẫu nhiên nên hash nhanh là đủ (không cần bcrypt). |
| Đoán key / tấn công thời gian | Tìm theo prefix công khai, rồi so sánh bằng `crypto.timingSafeEqual`; khi prefix không tồn tại vẫn chạy một phép so sánh giả. Key sai bị giới hạn theo IP (20 / 15 phút). |
| Key bị lộ dùng vào việc khác | Key **chỉ** được chấp nhận ở `/publish`; cookie phiên **không** được chấp nhận ở đó. Scope (`comics:write`, `chapters:write`) thu hẹp thêm quyền của key. |
| Phiên bị đánh cắp dùng để tạo key dài hạn | Tạo key phải nhập lại mật khẩu (giới hạn 10 lần / 15 phút / người dùng), và chủ tài khoản nhận thông báo. |
| Chủ key mất quyền | Role và trạng thái ban được đọc lại từ bảng `users` ở mỗi request: người bị hạ quyền hoặc bị ban thì key ngừng hoạt động ngay, `bulk:write` chỉ có tác dụng khi chủ key vẫn là admin. Đặt lại mật khẩu thu hồi mọi key. |
| Key bị bỏ quên | Bắt buộc có hạn (30/90/180/365 ngày), tối đa 10 key đang hoạt động, Studio hiện `lastUsedAt` / `lastUsedIp`, thu hồi một cú bấm. |
| Spam hàng đợi duyệt hoặc đầy ổ đĩa | 60 lượt upload / tài khoản / 10 phút, tính chung mọi key (`PUBLISH_RATE_LIMIT`), và tối đa 10 truyện mới / tài khoản / giờ, tính chung với Studio (`COMIC_CREATE_RATE_LIMIT`); trả `429` kèm `Retry-After`. Key và scope được kiểm tra **trước** khi multer ghi file. 10 MB / ảnh, 100 trang / chapter. |
| File độc hại | MIME khai báo phải là JPEG/PNG/WEBP/GIF (không SVG) **và** magic bytes của file phải khớp; tên file lưu là UUID ngẫu nhiên. Request lỗi tự xoá file đã upload. |
| Metadata sai hoặc rác | Kiểm tra chặt: enum, độ dài, mẫu slug, khoảng năm; genre/format phải thuộc danh mục cố định (API không bao giờ tạo genre mới). Trùng url truyện / số chapter → `409`. |
| Lách kiểm duyệt | Upload đi qua cùng service với Studio: `pending` trừ khi admin bật tự duyệt; truyện chưa duyệt chỉ nhận chapter từ chính contributor của nó. |

Key có dạng `ink_<12 hex>_<43 base64url>` để dễ nhận ra khi bị lộ (ví dụ bởi công cụ quét secret).

Thứ tự middleware trên route upload ([publishRoutes.js](../src/routes/publishRoutes.js)):
`kiểm tra key → scope → rate limit → multer ghi file → kiểm tra magic bytes → controller`.

## 4. Biến môi trường

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `PUBLISH_RATE_LIMIT` | 60 | lượt upload / tài khoản (mọi key) / 10 phút |
| `COMIC_CREATE_RATE_LIMIT` | 10 | truyện mới / tài khoản / giờ, Studio và API cộng chung; lần tạo thất bại không tính |
| `PUBLISH_BAD_KEY_LIMIT` | 20 | key sai / IP / 15 phút |
| `PUBLISH_BULK_RATE_LIMIT` | 10 | lần nhập hàng loạt / key / giờ |
| `BULK_MAX_ARCHIVE_MB` | 2048 | dung lượng file zip |
| `BULK_MAX_UNCOMPRESSED_MB` | 4096 | tổng dung lượng sau giải nén |
| `BULK_MAX_ENTRIES` | 20000 | số entry trong zip |
| `REQUEST_TIMEOUT_MS` | 30 phút | thời gian tối đa để nhận xong body request (mặc định của Node là 5 phút, không đủ cho zip lớn) |
