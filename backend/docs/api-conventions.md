# Quy ước REST API, versioning và tài liệu OpenAPI

Tài liệu này ghi lại **chiến lược đã chọn**, **vì sao chọn**, và **cách áp dụng** khi thêm endpoint mới.

- Tài liệu tương tác (Swagger UI): <http://localhost:5000/api/docs>
- File OpenAPI thô (cho Postman, sinh client...): <http://localhost:5000/api/v1/openapi.json>
- Nguồn của tài liệu: [src/docs/openapi.yaml](../src/docs/openapi.yaml)

## Mục lục

0. [Xác thực](#0-xác-thực)
1. [Versioning](#1-versioning-đặt-version-trên-uri-apiv1)
2. [Thiết kế URL](#2-thiết-kế-url)
3. [Status code](#3-status-code)
4. [Phân trang, lọc, sắp xếp](#4-phân-trang-lọc-sắp-xếp)
5. [Tài liệu API: OpenAPI 3.1](#5-tài-liệu-api-openapi-31-design-first)
6. [Bảng đổi URL (v0 → v1)](#6-bảng-đổi-url-v0--v1)
7. [Checklist khi thêm endpoint](#7-checklist-khi-thêm-endpoint)
8. [Logging](#8-logging)

---

## 0. Xác thực

| Ai gọi | Cách xác thực | Dùng ở đâu |
|---|---|---|
| Trình duyệt (frontend) | **Cookie phiên `sid`**: `HttpOnly`, `SameSite=Lax`, `Path=/api`, `Secure` khi production. `POST /auth/login` đặt cookie; token **không** nằm trong body | mọi route |

- Frontend gọi `fetch(..., { credentials: 'include' })`; CORS chỉ cho các origin trong `CLIENT_ORIGIN`.
- **Chống CSRF**: request ghi dữ liệu có cookie phải có `Origin` (hoặc `Referer`) tin cậy ([csrfMiddleware.js](../src/middlewares/csrfMiddleware.js)).
- Phiên hết hạn sau 30 ngày; đổi mật khẩu đăng xuất các phiên khác; đặt lại mật khẩu đăng xuất mọi phiên.
- Admin ZIP restore dùng cookie phiên và chỉ dành cho role `admin`. Trình duyệt đọc ZIP rồi gửi từng ảnh vào vùng staging riêng; nội dung chỉ được ghi sau khi toàn bộ batch hợp lệ.

---

## 1. Versioning: đặt version trên URI (`/api/v1`)

| Cách | Ví dụ | Ưu | Nhược |
|---|---|---|---|
| **URI path** ✅ | `/api/v1/comics` | Nhìn là thấy; test bằng trình duyệt/curl dễ; cache, log, proxy phân biệt được; Swagger hỗ trợ trực tiếp | URL dài thêm một đoạn |
| Header | `Accept: application/vnd.comic.v1+json` | URL "sạch" | Khó test bằng trình duyệt, dễ quên header, cache phải `Vary` |
| Query | `/comics?version=1` | Đơn giản | Dễ lẫn với filter, không chuẩn |

**Chọn URI path** vì dự án nhỏ, frontend gọi bằng `fetch`, và người học cần thấy rõ version.

**Khi nào tăng version?** Chỉ khi có thay đổi **phá vỡ** client cũ: đổi/xoá URL, đổi tên field, đổi kiểu dữ liệu, đổi ý nghĩa status code. Thêm field mới, thêm endpoint mới, thêm query param tuỳ chọn **không** cần version mới.

**Cách làm v2:** tạo `src/routes/v2/index.js`, mount `app.use('/api/v2', v2Routes)` cạnh v1. Router v2 dùng lại service; chỉ controller/route khác. v1 chạy song song đến khi frontend chuyển xong, rồi trả `410 Gone` một thời gian trước khi xoá.

---

## 2. Thiết kế URL

- **Danh từ số nhiều**, không dùng động từ: `POST /comics`, không phải `/comics/create`.
- **Lồng tối đa một cấp** khi tài nguyên con chỉ có nghĩa trong cha: `/comics/:comicId/chapters`, `/comics/:comicId/comments`.
- **Tài nguyên con được định danh bằng id riêng** thì có URL riêng: `/chapters/:chapterId`, `/comments/:commentId`.
- **`/me`** cho mọi thứ thuộc về người đang đăng nhập (profile, follow, rating, lịch sử, thông báo). Không cần đưa `userId` vào URL, và không thể vô tình truy cập dữ liệu người khác.
- **Hành động → thay đổi trạng thái của một tài nguyên**: "follow truyện" là `PUT /me/following/:comicId`, "duyệt truyện" là `PATCH /moderation/comics/:id { status }`, "khoá user" là `PATCH /admin/users/:id { isBanned }`.
- Trang đọc nhận **id hoặc slug** ở `:comicId` (`GET /comics/one-piece`); các thao tác ghi dùng id.

### Chọn method

| Method | Dùng khi | Idempotent? |
|---|---|---|
| `GET` | Đọc | ✅ |
| `POST` | Tạo tài nguyên mới, server sinh id | ❌ |
| `PUT` | Đặt trạng thái **toàn bộ** của một tài nguyên client biết URL (`/me/following/:comicId`, `/me/ratings/:comicId`, `/comments/:id/reaction`) | ✅ gọi 2 lần = 1 lần |
| `PATCH` | Sửa **một phần** (`PATCH /me`, `PATCH /admin/users/:id`) | — |
| `DELETE` | Xoá; xoá thứ không còn tồn tại vẫn `204` khi hợp lý (unfollow, xoá lịch sử) | ✅ |

Ví dụ: trước đây "react lại cùng loại" sẽ **bật/tắt** (toggle) – gọi 2 lần cho 2 kết quả khác nhau. Giờ `PUT /comments/:id/reaction { type: 'like' }` luôn cho ra "đang like", còn bỏ like là `DELETE`.

---

## 3. Status code

| Code | Khi nào | Body |
|---|---|---|
| `200 OK` | Đọc / sửa thành công | `{ data }` hoặc `{ data, meta }` |
| `201 Created` | Tạo mới (POST, hoặc PUT tạo mới) | `{ data }` + header `Location: /api/v1/...` |
| `204 No Content` | Thành công, không có gì để trả (DELETE, logout, đổi mật khẩu) | không có |
| `400 Bad Request` | Input sai: body, path, **cả query string** (`pageSize=500`, `sort=password`) | problem |
| `401 Unauthorized` | Thiếu/sai/hết hạn phiên (cookie `sid`) hoặc sai mật khẩu | problem |
| `403 Forbidden` | Đã đăng nhập nhưng không có quyền; tài khoản bị ban; request bị chặn vì khác origin (CSRF) | problem |
| `404 Not Found` | Không tồn tại **hoặc không được thấy** (thông báo của người khác → 404, không phải 403, để không lộ id) | problem |
| `409 Conflict` | Trùng dữ liệu (username, slug, tên category) | problem |
| `413 Payload Too Large` | File > 10 MB, quá số file cho phép, body JSON > 5 MB hoặc ZIP restore vượt giới hạn | problem |
| `415 Unsupported Media Type` | Upload không phải JPEG/PNG/WEBP/GIF | problem |
| `429 Too Many Requests` | Vượt rate limit đăng nhập/đăng ký/đặt lại mật khẩu, gợi ý tìm kiếm, hoặc tạo truyện. Có header `RateLimit` | problem |
| `500` | Lỗi không lường trước. Chi tiết chỉ ghi log, client chỉ thấy "Internal server error" | problem |

Route không tồn tại cũng trả **JSON 404**, không còn trang HTML mặc định của Express.

### Định dạng lỗi: RFC 9457 (Problem Details)

```http
HTTP/1.1 400 Bad Request
Content-Type: application/problem+json

{
  "type": "about:blank",
  "title": "Bad Request",
  "status": 400,
  "detail": "\"pageSize\" must be between 1 and 100",
  "instance": "/api/v1/comics?pageSize=500"
}
```

Code: [errorMiddleware.js](../src/middlewares/errorMiddleware.js). Service chỉ cần `throw new NotFoundError('Comic not found')`.

---

## 4. Phân trang, lọc, sắp xếp

Mọi **collection có thể lớn** dùng chung một bộ tham số, parse bởi [src/utils/listQuery.js](../src/utils/listQuery.js):

| Tham số | Ví dụ | Ghi chú |
|---|---|---|
| `page` | `page=2` | Bắt đầu từ 1 |
| `pageSize` | `pageSize=20` | Mặc định 20, tối đa 100 (chapter: 100 / 1000, comment: 10 / 50) |
| `sort` | `sort=-rating,name` | Danh sách field cách nhau bởi dấu phẩy, `-` = giảm dần. Chỉ field trong whitelist |
| filter nhiều giá trị | `contentRating=safe,suggestive` hoặc `contentRating=safe&contentRating=suggestive` | Giá trị enum được kiểm tra |
| `q` | `q=one piece` | Tìm theo chữ |

Response:

```json
{
  "data": [ ... ],
  "meta": { "page": 2, "pageSize": 20, "totalItems": 92, "totalPages": 5 }
}
```

Hai quy tắc quan trọng:

1. **Sai thì báo 400, không tự sửa.** `pageSize=500` trước đây bị lặng lẽ đổi thành 20; client không biết mình nhận ít hơn mong muốn.
2. **Luôn có khoá sắp xếp phụ duy nhất** (`id`) ở cuối `ORDER BY`. Nếu nhiều truyện cùng `rating`, thiếu khoá phụ thì một truyện có thể xuất hiện ở cả trang 1 lẫn trang 2.

### `GET /comics` thay cho 4 endpoint

| Trước | Giờ |
|---|---|
| `GET /comics?page=` | `GET /api/v1/comics?page=` |
| `GET /comics/popular` | `GET /api/v1/comics?sort=-view&pageSize=10` |
| `GET /comics/top-rated?limit=8` | `GET /api/v1/comics?sort=-rating,-view&pageSize=8` |
| `GET /comics/search?q=x` | `GET /api/v1/comics?q=x&pageSize=6` (khớp đúng tên lên đầu khi không truyền `sort`) |

Mỗi item đều có `genres` và `latestChapters`. Filter: `contentRating`, `type`, `releaseStatus`, `genre`, `format`, `q` (tìm không dấu, không phân biệt hoa thường: "kiem than" khớp "Kiếm Thần").

Các danh sách khác của truyện: `GET /comics/rankings?period=day|week|month|all`, `GET /comics/suggest?q=` (gợi ý khi gõ, tối đa 8), `GET /comics/:comicId/similar?limit=`, `GET /me/recommendations?limit=` (dùng `limit` thay cho phân trang vì là danh sách ngắn).

Collection **nhỏ và giới hạn tự nhiên** (danh sách đang follow, category, contributor của một truyện, hàng đợi moderation) trả về đủ trong `{ data }` mà không phân trang. Điều này ghi rõ trong OpenAPI.

---

## 5. Tài liệu API: OpenAPI 3.1, design-first

| Cách | Mô tả | Chọn? |
|---|---|---|
| **Design-first: một file YAML** | Viết `openapi.yaml` tay, Swagger UI hiển thị | ✅ |
| Code-first: chú thích JSDoc (`swagger-jsdoc`) | Viết `@openapi` trên từng route | ❌ chú thích dài làm rối file route, YAML rải rác khó review |
| Sinh từ validator (zod-to-openapi...) | Schema validate = schema tài liệu | ❌ cần thêm thư viện validate, quá sức với dự án hiện tại |

**Chống lệch tài liệu với code**: [tests/conventions.test.js](../tests/conventions.test.js) có 2 test:
- spec phải hợp lệ theo chuẩn OpenAPI (`@apidevtools/swagger-parser`);
- **mọi route Express phải có trong spec, và mọi operation trong spec phải có route**. Thêm route mà quên viết tài liệu thì `npm test` đỏ.

---

## 6. Bảng đổi URL (v0 → v1)

Tất cả URL dưới đây có tiền tố `/api/v1`.

| Cũ | Mới |
|---|---|
| `POST /auth/logout` → 200 | `POST /auth/logout` → **204** |
| `GET/PUT /user/profile` | `GET /me`, **`PATCH /me`** |
| `PUT /user/profile/avatar`, `/background` | `PUT /me/avatar`, `PUT /me/background` |
| `PUT /user/password-reset` | `PUT /me/password` → 204 |
| `PUT /user/preferences` | `PATCH /me/preferences` |
| `GET /user/following` | `GET /me/following` |
| `GET/POST /user/following/categories`, `PUT/DELETE .../:id` | `GET/POST /me/following-categories`, `PATCH/DELETE .../:id` |
| `GET/POST/DELETE /comics/:id/follow`, `PUT /user/following/:id/category` | `GET/PUT/DELETE /me/following/:comicId` (PUT `{ categoryId }` vừa follow vừa chuyển category) |
| `POST/DELETE /comics/:id/bookmark`, `GET /user/bookmarks` | Đã bỏ (trùng với following) |
| `POST /comics/:id/rate` | `PUT /me/ratings/:comicId` (`averageRating` thay cho `newAverageRating`) |
| `PUT/POST /comics/chapters/:id/history`, `GET/DELETE /user/history` | `PUT /me/history/:chapterId`, `GET/DELETE /me/history`, `DELETE /me/history/:chapterId` |
| `GET /notifications`, `PATCH /notifications/:id/read` | `GET /me/notifications`, `PATCH /me/notifications/:id { isRead }` |
| `GET /comments/user` | `GET /me/comments` |
| `GET /user/comic-contributions`, `/chapter-contributions` | `GET /me/contributions/comics`, `/chapters` |
| `GET /comics/:url`, `GET /comics/:url/chapters` | giữ nguyên (nhận id hoặc slug); chapters có phân trang |
| `GET /comics/chapters/:id` | `GET /chapters/:chapterId` |
| `GET/POST /comments/comics/:id`, `/comments/chapters/:id` | `GET/POST /comics/:id/comments`, `/chapters/:id/comments` (page/pageSize/sort thay cho limit/offset/sortBy) |
| `GET /comments/detail/:id` | `GET /comments/:id` (trả comment + `type`, không bọc trong `{ comment }`) |
| `PATCH/DELETE /comments/:kind/:id` | `PATCH/DELETE /comments/:id` |
| `POST/DELETE /comments/:kind/:id/react { reactionType }` | `PUT/DELETE /comments/:id/reaction { type }` |
| `PUT /comics/:id/contributors/:userId` | **`PATCH`** `/comics/:id/contributors/:userId` (chapter tương tự) |
| `PATCH .../contributors/:userId/read` (410) | đã xoá |
| `/moderator/...` | `/moderation/...` |
| `PATCH /moderator/:type/:id`, `/moderator/comics/:id/status` | `PATCH /moderation/comics/:id`, `/moderation/chapters/:id` |
| `GET /moderator/comic/:id` | `GET /moderation/comics/:id` |
| `DELETE /moderator/comments/:kind/:id` | `DELETE /moderation/comments/:id` → 204 |
| `GET /admin/comics-dashboard`, `/chapters-dashboard` | `GET /admin/comics`, `/admin/chapters` (phân trang, lọc `status`, `visibility`) |
| `PATCH /admin/comics/:id/visibility` | `PATCH /admin/comics/:id { visibility }` |
| `PATCH /admin/users/:id/role`, `/ban` | `PATCH /admin/users/:id { role?, isBanned? }` |
| `PATCH /admin/comments/:type/:id/ban` | `PATCH /admin/comments/:id { isBanned }` |
| `PATCH /admin/settings/auto-accept { enabled }` | `GET/PATCH /admin/settings { autoAccept }` |

Response thành công **không còn field `status: 'success'`** (HTTP status đã nói điều đó): `{ data }` / `{ data, meta }`. Response lỗi cũng không còn `{ status: 'fail', message }` mà theo RFC 9457 (mục 3).

Frontend đã chuyển xong: mọi thay đổi nằm trong [frontend/src/services/api.ts](../../frontend/src/services/api.ts), chữ ký các hàm giữ nguyên nên component không phải sửa.

---

## 7. Checklist khi thêm endpoint

1. Chọn URL theo mục 2, method theo bảng ở mục 2, status code theo mục 3.
2. Collection có thể lớn → `parsePagination` + `parseSort(query.sort, WHITELIST)` + `pageMeta`, trả `ok(res, items, meta)`.
3. Tạo mới → `created(res, '/resource/:id', data)`; không có gì trả → `noContent(res)` ([src/utils/http.js](../src/utils/http.js)).
4. Lỗi → `throw new XxxError(...)` trong service.
5. Thêm operation vào `src/docs/openapi.yaml`.
6. `npm test`: test "documents exactly the routes the server implements" sẽ đỏ nếu bước 5 bị quên.

---

## 8. Logging

Backend ghi mỗi sự kiện thành một JSON object trên một dòng trong `backend/logs/`:

| File | Nội dung |
|---|---|
| `app.log` | Vòng đời ứng dụng và log lỗi nội bộ |
| `errors.log` | Bản lọc chỉ gồm lỗi cấp `error` từ application logger |
| `access.log` | Một record cho mỗi HTTP request: request ID, method, path (không gồm query), route template, status, thời lượng và IP |
| `audit.log` | Sự kiện bảo mật/xác thực và thay đổi dữ liệu quan trọng, gồm actor, action, outcome, resource và các trường thay đổi an toàn |

Record tuân theo cấu trúc JSON có `timestamp`, `log.level`, `process.pid`, `labels.app`, `thread.name`, `logger`, `message`, `service.name` và `event.dataset`. Dataset lần lượt là `application`, `access` và `audit`.

Không ghi request body, mật khẩu, cookie/session token hay thông tin xác thực. Audit log là file JSON Lines cho các sự kiện nghiệp vụ được chọn, không phải bản ghi mọi câu SQL. Các sự kiện bảo mật có thể kèm IP nguồn; audit thay đổi dữ liệu chỉ ghi actor và thông tin tài nguyên cần thiết.

### Quan sát bằng Grafana

Monitoring chạy trên một server riêng bằng `monitoring/docker-compose.yml` (Prometheus, Loki, Grafana; khởi động bằng `sudo bash monitoring/init.sh`). Ứng dụng chạy trực tiếp trên app server: Nginx cài trên host (`nginx/default.conf`) phục vụ frontend từ `/var/www/comic-app`, reverse-proxy `/api/` tới backend `127.0.0.1:5000` (systemd) và chỉ proxy GET/HEAD trên `/storage/` tới bucket public-read của SeaweedFS `127.0.0.1:8333` (một container chạy bằng `storage/seaweedfs/init.sh`). Grafana mặc định ở cổng `3017`; Loki mở cổng `3100` cho agent và phải được firewall chỉ cho IP app server.

Dashboard **Comic App Overview** được provision tự động. Prometheus scrape `/metrics` qua listener riêng của Nginx trên app server (`<APP_SERVER_IP>:9464`, có danh sách `allow` IP); metric labels dùng Express route template, không dùng URL có ID. Runtime panels mô tả process Node.js (CPU, RSS, heap và event loop), không phải toàn bộ host. Loki nhận `app*.log`, `access*.log` và `audit*.log` (cùng access log JSON của Nginx, `job=comic-app-nginx`) qua Alloy agent cài trực tiếp trên app server (systemd, cấu hình ở `backend/monitoring-agent/`); `errors.log` không ingest riêng vì lỗi đã có trong `app.log`. Chỉ `job`, `service_name` và `log_type` là labels cố định để tránh tạo cardinality cao. Không đưa user ID, request ID, IP hoặc resource ID thành labels.

Prometheus đánh giá các alert target-down, 5xx, p95 latency và process RSS; trạng thái firing xuất hiện trên dashboard. Chưa cấu hình email/Slack/webhook contact point vì chưa có đích nhận cảnh báo; cần thiết lập riêng trước khi dựa vào cảnh báo chủ động.

Trên production, SQLite nằm trong `/var/lib/comic-app/data/` (`DB_PATH`), ảnh local trong `/var/lib/comic-app/storage/` (`STORAGE_ROOT`) và SeaweedFS lưu object trong `/var/lib/seaweedfs` (bind mount). Database image fields lưu object keys tương đối (`comics/...`, `chapter-images/...`, `avatars/...`, `backgrounds/...`) để không phụ thuộc đường dẫn máy chủ hay domain nhà cung cấp. Logs của backend nằm trong `/var/log/comic-app/` (`LOG_DIR`) và được Alloy đọc read-only; Winston giữ tối đa 5 file × 10 MiB cho mỗi file transport. Nginx ghi access log JSON vào `/var/log/nginx/comic-app.access.log` (dùng logrotate của hệ thống). Metrics được lưu 15 ngày (tối đa 2 GiB), Loki 7 ngày; dữ liệu Prometheus, Loki và Grafana nằm trong `/var/lib/comic-monitoring/` trên server monitoring. Backup `/var/lib/comic-app/` cùng lúc với `/var/lib/seaweedfs/` và các thư mục monitoring theo chính sách triển khai.

Backend chạy dưới user hệ thống `comic`, chỉ có quyền ghi `/var/lib/comic-app` và `/var/log/comic-app` (xem `backend/comic-app-backend.service`), và bind vào `127.0.0.1` (`HOST`) để chỉ truy cập được qua Nginx.
