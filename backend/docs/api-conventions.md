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

---

## 0. Xác thực

| Ai gọi | Cách xác thực | Dùng ở đâu |
|---|---|---|
| Trình duyệt (frontend) | **Cookie phiên `sid`**: `HttpOnly`, `SameSite=Lax`, `Path=/api`, `Secure` khi production. `POST /auth/login` đặt cookie; token **không** nằm trong body | mọi route trừ `/publish` |
| Script của contributor | **API key**: `Authorization: Bearer ink_...` | chỉ `/publish` (xem [publishing-api.md](publishing-api.md)) |

- Frontend gọi `fetch(..., { credentials: 'include' })`; CORS bật `credentials: true` và chỉ cho các origin trong `CLIENT_ORIGIN`.
- **Chống CSRF**: request thay đổi dữ liệu (không phải GET/HEAD/OPTIONS) có cookie phải có `Origin` (hoặc `Referer`) nằm trong danh sách tin cậy, nếu không → `403` ([csrfMiddleware.js](../src/middlewares/csrfMiddleware.js)). `SameSite=Lax` là lớp bảo vệ thứ hai.
- Phiên hết hạn sau 30 ngày; đổi mật khẩu đăng xuất mọi phiên khác; đặt lại mật khẩu đăng xuất tất cả và thu hồi mọi API key.

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
| `401 Unauthorized` | Thiếu/sai/hết hạn phiên (cookie `sid`) hoặc API key, sai mật khẩu. Có header `WWW-Authenticate: Bearer` | problem |
| `403 Forbidden` | Đã đăng nhập nhưng không có quyền; tài khoản bị ban khi đăng nhập; API key thiếu scope; request bị chặn vì khác origin (CSRF) | problem |
| `404 Not Found` | Không tồn tại **hoặc không được thấy** (thông báo của người khác → 404, không phải 403, để không lộ id) | problem |
| `409 Conflict` | Trùng dữ liệu (username, slug, tên category) | problem |
| `413 Payload Too Large` | File > 10 MB, quá số file cho phép, body JSON > 1 MB | problem |
| `415 Unsupported Media Type` | Upload không phải JPEG/PNG/WEBP/GIF | problem |
| `429 Too Many Requests` | Vượt rate limit: đăng nhập/đăng ký/đặt lại mật khẩu (20 / 15 phút / IP), gợi ý tìm kiếm (60 / phút), tạo truyện (10 / giờ / tài khoản), publishing API. Có header `RateLimit` (và `Retry-After` ở `/publish`) | problem |
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

Mỗi item đều có `genres` và `latestChapters`. Filter: `contentRating`, `type`, `demographic`, `releaseStatus`, `genre`, `format`, `q` (tìm không dấu, không phân biệt hoa thường: "kiem than" khớp "Kiếm Thần").

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
