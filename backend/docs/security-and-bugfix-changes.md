# Bảo mật backend và các lỗi đã sửa

Tài liệu gồm hai phần:

- **Phần A:** các lớp bảo mật backend đang có (trạng thái hiện tại).
- **Phần B:** 20 lỗi bảo mật và lỗi logic tìm thấy và sửa ngày 2026-10-03, mỗi lỗi ghi rõ code sửa
  **hiện nằm ở đâu** và test nào bảo vệ nó.

> Bản gốc của tài liệu này (tiếng Anh, có code cũ/mới cho từng lỗi) vẫn xem được trong git:
> `git show b5815a6:backend/docs/security-and-bugfix-changes.md`. Đường dẫn file trong bản đó là của
> code trước khi tách tầng (`userModel.js`, `dbhelper.js`, `chaptersRoutes.js`... nay đã xoá).

## Mục lục

- [Phần A. Các lớp bảo mật hiện có](#phần-a-các-lớp-bảo-mật-hiện-có)
- [Phần B. 20 lỗi đã sửa](#phần-b-20-lỗi-đã-sửa)
- [Việc còn mở](#việc-còn-mở)
- [Khi triển khai](#khi-triển-khai)

---

## Phần A. Các lớp bảo mật hiện có

### A1. Tài khoản và phiên đăng nhập

| Biện pháp | Chi tiết | Code |
|---|---|---|
| Hash mật khẩu bằng **bcrypt** | 10 rounds. Mật khẩu 6–72 ký tự (bcrypt bỏ qua phần sau byte thứ 72). Dòng cũ còn lưu dạng thô được tự hash lại ở lần đăng nhập đúng đầu tiên, không cần reset | `services/authService.js` |
| Phiên trong **cookie HttpOnly** | Cookie `sid`: `HttpOnly` (script trên trang, kể cả mã XSS, không đọc được), `SameSite=Lax`, `Path=/api`, `Secure` khi production. Token không bao giờ nằm trong body. Hết hạn sau 30 ngày | `utils/sessionCookie.js`, `controllers/authController.js` |
| Chống **CSRF** | Request ghi dữ liệu có cookie phải đến từ origin tin cậy (header `Origin`, dự phòng `Referer`), theo khuyến nghị OWASP "verify origin with standard headers" | `middlewares/csrfMiddleware.js` |
| Ban có hiệu lực ngay | Người bị ban không đăng nhập được (`403`), và mọi phiên cũ bị từ chối ở request kế tiếp | `authService.login`, `repositories/sessionRepository.js` |
| Đổi mật khẩu | Phải nhập đúng mật khẩu hiện tại; mọi phiên **khác** bị đăng xuất | `services/userService.js` |
| Quên mật khẩu | Token ngẫu nhiên 256 bit, chỉ lưu SHA-256, hết hạn sau 30 phút, dùng một lần. Luôn trả `204` dù email có tồn tại hay không (không dò được tài khoản). Đặt lại xong thì đăng xuất mọi nơi và thu hồi mọi API key | `authService.requestPasswordReset`, `resetPassword` |
| Rate limit đăng nhập | 20 lần / 15 phút / IP cho login, register, password reset | `app.js` |

### A2. Phân quyền

| Tầng | Câu hỏi | Code |
|---|---|---|
| Route | "Loại người dùng này có được gọi endpoint này không?" → `requireRole(...)`; `router.use(...)` cho cả router admin/moderation để route mới tự được bảo vệ | `middlewares/authMiddleware.js`, `routes/adminRoutes.js` |
| Service | "Người này có được động vào **tài nguyên này** không?" (contributor chỉ sửa truyện của mình) | `services/permissions.js` (`isStaff`, `canManageComic`) |
| Dữ liệu người đọc thấy | Chỉ nội dung đã duyệt, công khai, chưa xoá: `READABLE` / `readableSql()` dùng ở mọi trang đọc, bất kể role | `repositories/visibility.js` |
| Không lộ sự tồn tại | Tài nguyên của người khác hoặc bị ẩn trả `404`, không phải `403` | các service |

Role hợp lệ: `user`, `contributor`, `moderator`, `admin`. Admin không tự đổi role hoặc tự ban mình được.

### A3. Upload file

| Biện pháp | Chi tiết |
|---|---|
| Whitelist MIME | Chỉ JPEG, PNG, WEBP, GIF. **Không SVG** (SVG chứa được script và được phục vụ từ chính origin của API → stored XSS) |
| Tên file do server đặt | `randomUUID()` + đuôi suy ra từ MIME đã kiểm tra, không bao giờ lấy tên/đuôi client gửi |
| Kiểm tra magic bytes | Publishing API đọc 12 byte đầu của mỗi file và so với loại khai báo (`middlewares/imageSignatureMiddleware.js`) |
| Giới hạn | 10 MB / ảnh; 50 trang / chapter (Studio), 100 trang (API); vượt → `413` |
| Dọn file khi request lỗi | Multer ghi file trước khi controller chạy; nếu response ≥ 400 thì file bị xoá (`cleanupUploadsOnFailure`) |
| Đường dẫn cố định | `storage/` tính từ vị trí file code (hoặc `STORAGE_ROOT`), không phụ thuộc thư mục chạy lệnh; `express.static` với `dotfiles: 'deny'` |
| Zip nhập hàng loạt | Lưu ở thư mục tạm của OS, kiểm tra số entry, dung lượng, đường dẫn (`..`, tuyệt đối) trước khi giải nén |

### A4. HTTP và lỗi

| Biện pháp | Chi tiết | Code |
|---|---|---|
| **helmet** | Các header bảo mật: `X-Content-Type-Options: nosniff`, `X-Frame-Options`, `Content-Security-Policy`...; `Cross-Origin-Resource-Policy: cross-origin` để frontend khác origin vẫn tải được ảnh | `app.js` |
| Ẩn framework | `app.disable('x-powered-by')` | `app.js` |
| **CORS** giới hạn | Chỉ các origin trong `CLIENT_ORIGIN` (mặc định Vite dev `localhost:5173`), `credentials: true` | `app.js` |
| Giới hạn body | JSON / urlencoded tối đa 1 MB | `app.js` |
| Không lộ lỗi nội bộ | Lỗi ≥ 500 chỉ ghi log, client nhận `"Internal server error"`; định dạng RFC 9457 | `middlewares/errorMiddleware.js` |
| SQL injection | Mọi giá trị đi qua Sequelize hoặc placeholder `?`; tên bảng/cột ghép vào SQL chỉ lấy từ bảng tra cố định trong code; `sort` chỉ nhận field trong whitelist | `config/database.js`, `utils/listQuery.js` |
| Rate limit khác | Gợi ý tìm kiếm 60 / phút / IP; tạo truyện 10 / giờ / tài khoản; publishing API (xem [publishing-api.md](publishing-api.md)) | `routes/comicRoutes.js`, `middlewares/rateLimitMiddleware.js` |

### A5. Toàn vẹn dữ liệu

- **Khoá ngoại có hiệu lực**: Sequelize bật `PRAGMA foreign_keys = ON` trên mỗi kết nối SQLite.
- **Transaction** cho mọi thao tác ghi nhiều bước (`withTransaction`, `BEGIN IMMEDIATE`, xếp hàng); kiểm tra
  trùng lặp nằm **trong** transaction để tránh race condition kiểu *check-then-act*.
  Xem [orm-sequelize.md](orm-sequelize.md#4-transaction).
- Xoá comment là **xoá mềm** (`content = ''`, `deletedAt`) để reply và reaction vẫn có cha hợp lệ.

---

## Phần B. 20 lỗi đã sửa

Mức độ: 🔴 nghiêm trọng · 🟠 trung bình · 🟡 lỗi logic.

| # | Mức | Lỗi | Cách sửa | Code hiện tại | Test |
|---|---|---|---|---|---|
| 1 | 🔴 | **Tự duyệt truyện của mình**: route đổi trạng thái contributor chỉ cần đăng nhập, ai cũng duyệt được bài của mình | Thêm `requireRole('admin','moderator')` | `routes/comicRoutes.js` (`staff`) | `authorization.test.js` |
| 2 | 🔴 | **Mật khẩu lưu dạng thô** (file `.sqlite` từng nằm trong git) | bcrypt, tự nâng cấp dòng cũ khi đăng nhập; `seed.js` cũng hash | `services/authService.js` | `auth.test.js` |
| 3 | 🔴 | **Contributor sửa được truyện bất kỳ** | Chỉ contributor của truyện đó hoặc staff | `services/permissions.js`, `comicService.update` | `authorization.test.js` |
| 4 | 🔴 | **Đổi mật khẩu không cần mật khẩu cũ**; phiên cũ vẫn sống | Bắt buộc mật khẩu hiện tại; đăng xuất các phiên khác; giới hạn 6–72 ký tự. Frontend thêm ô "Current password" | `services/userService.js` | `authorization.test.js` |
| 5 | 🔴 | **Ban không có tác dụng**: không chỗ nào đọc `isBanned` | Chặn khi đăng nhập (`403`) và khi đọc phiên | `authService.login`, `sessionRepository.js` | `auth.test.js` |
| 6 | 🔴 | **Upload không giới hạn**: nhận mọi loại file, giữ đuôi của client → upload `.html`/`.svg` chứa JS (stored XSS); không giới hạn dung lượng; tên file dùng `Math.random()`; đường dẫn phụ thuộc `process.cwd()` | Whitelist MIME, tên UUID + đuôi theo MIME, 10 MB / 100 file, đường dẫn tuyệt đối | `middlewares/uploadMiddleware.js` | `authorization.test.js` (chặn SVG) |
| 7 | 🔴 | **Gán role tuỳ ý** (`"superadmin"`, `""`); admin tự hạ quyền/tự ban mình | Kiểm tra role trong danh sách hợp lệ; không cho tự sửa mình | `services/adminService.js` | `authorization.test.js` |
| 8 | 🟠 | **CORS mở cho mọi site**, không có header bảo mật, lộ `X-Powered-By`, không rate limit đăng nhập | `cors({ origin })`, helmet, `express-rate-limit`, giới hạn body 1 MB | `app.js` | — |
| 9 | 🟠 | **Lộ lỗi nội bộ**: thông báo SQLite (`no such column...`) gửi thẳng cho client; lỗi upload ra 500 | Che lỗi ≥ 500; lỗi multer thành 400/413 | `middlewares/errorMiddleware.js` | `conventions.test.js` (định dạng lỗi) |
| 10 | 🟠 | **Đăng ký không kiểm tra dữ liệu**: username có khoảng trắng/HTML, email sai, mật khẩu 1 ký tự, tên hiển thị 10 MB | Username `^[A-Za-z0-9_.-]{3,32}$`, email ≤ 254, mật khẩu 6–72, tên hiển thị 1–50 | `authService.register` | `auth.test.js` (400, 409) |
| 11 | 🟠 | **Sửa được category mặc định dùng chung** (`userId IS NULL`) cho mọi người | Chỉ sửa/xoá category của chính mình (`findOwned`) | `repositories/categoryRepository.js` | — |
| 12 | 🟠 | **Chapter bị ẩn/xoá vẫn đọc được bằng id** | Trang đọc chỉ trả nội dung `READABLE` (đã duyệt, công khai, chưa xoá, truyện cũng vậy); staff xem qua route moderation riêng | `repositories/visibility.js`, `chapterService.openForReading` | `comics.test.js` (hidden chapters, awaiting review) |
| 13 | 🟡 | `GET /comics` và `/comics/popular` **lỗi 500 khi không có filter** (SQL thành `FROM comics AND ...`); `totalPages` đếm cả truyện ẩn; `?page=abc` → `OFFSET NaN` | Viết lại truy vấn; tham số sai trả `400` | `utils/listQuery.js`, `repositories/comicRepository.js` | `comics.test.js` (400 cho query sai) |
| 14 | 🟡 | Chi tiết truyện: gõ nhầm `contry`, thiếu cột `status` → luôn `undefined` | Sửa tên cột, thêm cột | `services/comicService.js` | — |
| 15 | 🟡 | Cột `read_history.scrollPosition` **thiếu trong schema** → DB mới lỗi 500 khi đọc chapter | Khai báo trong model | `models/interaction.js` | — |
| 16 | 🟡 | **Khoá ngoại không có hiệu lực** (SQLite cần `PRAGMA foreign_keys = ON`). Bật lên thì lộ ra 3 chỗ hỏng: xoá cứng comment có reply, xoá category còn được tham chiếu, `seed.js` xoá sai thứ tự | Bật pragma; xoá comment thành xoá mềm; sửa thứ tự xoá trong seed | `config/database.js` (Sequelize), `repositories/commentRepository.js` | `comments.test.js` (force-delete) |
| 17 | 🟡 | **Không có transaction** cho thao tác nhiều bước (tạo truyện 5+ câu lệnh, duyệt bài sửa 2 bảng) | `withTransaction` xếp hàng, `BEGIN IMMEDIATE`; nay chạy trên Sequelize + `AsyncLocalStorage` | `config/database.js` | `services.test.js` (rollback) |
| 18 | 🟡 | **File upload bị từ chối vẫn nằm lại** trong `storage/` | Xoá file khi response ≥ 400 | `uploadMiddleware.cleanupUploadsOnFailure` | `comics.test.js` (failed edit), `bulkImport.test.js` |
| 19 | 🟡 | Endpoint contributor của `/chapters/...` **không được mount**, frontend nhận 404 | Mount router `/chapters` | `routes/comicRoutes.js` (`chapterRouter`) | `comics.test.js` (contributor review routes) |
| 20 | 🟡 | Đổi username sang tên đã có → **500** (vi phạm `UNIQUE`) | Kiểm tra trước, trả `409` | `services/userService.js` | — (`auth.test.js` chỉ kiểm tra trùng khi đăng ký) |

Lúc sửa (2026-10-03), cả 20 mục được kiểm chứng bằng 34 phép thử chạy trên bản sao DB thật. Phần lớn sau đó được
viết lại thành test tự động; dấu — là mục **chưa có test tự động**, nên bổ sung khi có dịp (Vitest + supertest, xem [instruction.md](../instruction.md#1-vì-sao-viết-test-trước-khi-refactor)),
chạy bằng `npm test`.

---

## Việc còn mở

| Việc | Trạng thái |
|---|---|
| Danh sách công khai chỉ hiện truyện đã duyệt (`status = 'accept'`) | ✅ Đã làm (`visibility.js`) |
| Bỏ track `comic-platform.sqlite` và `storage/` khỏi git | ✅ Đã làm (`.gitignore`) |
| Gộp code comment truyện/chapter, chỉ giữ `/api/v1`, có test | ✅ Đã làm (xem [instruction.md](../instruction.md)) |
| Avatar/ảnh nền upload bằng multipart (`PUT /me/avatar`, `/me/background`) | ✅ Có endpoint. `PATCH /me` vẫn nhận `avatar` dạng chuỗi, nên giới hạn JSON vẫn để 1 MB |
| Kiểm tra magic bytes cho upload từ **Studio** và avatar (hiện chỉ publishing API kiểm tra) | ⬜ Chưa. Rủi ro thấp: đuôi file luôn là đuôi ảnh và có `nosniff`, nhưng nên dùng chung `verifyImageSignatures` |
| Header `WWW-Authenticate: Bearer` trên mọi `401` | ⬜ Chỉ đúng với `/publish` (API key); các route khác dùng cookie |

## Khi triển khai

- Đặt `NODE_ENV=production` (cookie tự bật `Secure`) và chạy sau HTTPS.
- Đặt `CLIENT_ORIGIN=https://<domain-frontend>`; mặc định chỉ cho Vite dev server.
- Frontend khác *site* với API thì cần `COOKIE_SAMESITE=none` (bắt buộc kèm `Secure`); cùng site thì giữ `lax`.
- Cấu hình `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, `APP_URL` để gửi email đặt lại mật khẩu
  (không cấu hình thì email chỉ in ra console).
