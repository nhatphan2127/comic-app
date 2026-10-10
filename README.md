# Inkverse — nền tảng đọc truyện tranh

Web đọc manga / manhwa / manhua: đọc truyện, theo dõi, chấm điểm, bình luận, bảng xếp hạng, gợi ý truyện;
contributor đăng truyện qua **Studio** hoặc **Publishing API**; moderator/admin duyệt nội dung trong **Admin console**.

| Thư mục | Nội dung | Công nghệ chính |
|---|---|---|
| [`backend/`](backend/) | REST API `/api/v1`, lưu ảnh trong `backend/storage/` | Node.js (ESM), Express 4, Sequelize 6, SQLite |
| [`frontend/`](frontend/) | Ứng dụng web (SPA, cài được như app) | React 19, TypeScript, Vite, React Router 7, CSS Modules |
| [`comic-translation/`](comic-translation/) | Pipeline dịch trang truyện Anh → Việt (đang phát triển, chưa nối vào app) | Python, LangGraph, PyTorch, EasyOCR |

Tổng kết kỹ thuật, kiến trúc, tiêu chuẩn đã dùng: **[TECHNIQUES.md](TECHNIQUES.md)**.

## Mục lục

1. [Chạy dự án](#1-chạy-dự-án)
2. [Tài khoản mẫu](#2-tài-khoản-mẫu)
3. [Kiểm thử](#3-kiểm-thử)
4. [Biến môi trường](#4-biến-môi-trường)
5. [Tài liệu](#5-tài-liệu)
6. [Vai trò người dùng](#6-vai-trò-người-dùng)

---

## 1. Chạy dự án

Yêu cầu: Node.js 20+ (đang dùng 24).

```bash
# Backend: http://localhost:5000 (Swagger UI: http://localhost:5000/api/docs)
cd backend
npm install
npm run dev

# Frontend: http://localhost:5173 (terminal khác)
cd frontend
npm install
npm run dev
```

Lần chạy đầu, backend tự tạo `backend/data/comic-platform.sqlite` và các bảng còn thiếu.
Dữ liệu mẫu: `cd backend && node scripts/seed.js`. **Lệnh này xoá toàn bộ dữ liệu cũ** trước khi tạo dữ liệu mới.

Truyện và chapter mẫu được tạo ở trạng thái đã duyệt (`accept`). Truyện đăng mới sau đó sẽ ở trạng thái
`pending` chờ moderator duyệt, trừ khi bật *auto-accept* trong Admin → Settings.

Frontend gọi thẳng `http://localhost:5000` (hằng `API_ORIGIN` trong `frontend/src/services/api.ts`).

## 2. Tài khoản mẫu

Sau khi chạy `seed.js`:

| Username | Mật khẩu | Role |
|---|---|---|
| `admin` | `hashed_password_admin_123` | admin |
| `creator1` | `hashed_password_creator_1` | user |
| `creator2` | `hashed_password_creator_2` | user |
| `user1` | `hashed_password_user_1` | user |
| `user2` | `hashed_password_user_2` | user |

(Chuỗi `hashed_password_...` chỉ là tên mật khẩu mẫu; trong DB chúng được hash bằng bcrypt.)

## 3. Kiểm thử

```bash
cd backend && npm test                 # Vitest + supertest, DB in-memory, không đụng dữ liệu thật
cd frontend && npx tsc -b && npm run lint
cd comic-translation && python -m pytest
node backend/scripts/evalRecommendations.js   # đánh giá offline thuật toán gợi ý (Precision@10 / Recall@10)
```

## 4. Biến môi trường

Backend đọc trực tiếp từ môi trường (chưa có file `.env`). Không đặt gì thì dùng mặc định cho máy dev.

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `PORT` | `5000` | cổng backend |
| `CLIENT_ORIGIN` | `http://localhost:5173,http://127.0.0.1:5173` | origin frontend được phép (CORS + chống CSRF), cách nhau bởi dấu phẩy |
| `NODE_ENV` | — | `production` → cookie phiên có `Secure` |
| `COOKIE_SECURE` / `COOKIE_SAMESITE` | theo `NODE_ENV` / `lax` | ghi đè thuộc tính cookie `sid` |
| `DB_PATH` | `backend/data/comic-platform.sqlite` | file SQLite (`:memory:` khi test) |
| `STORAGE_ROOT` | `backend/storage` | thư mục ảnh upload |
| `APP_URL` | `http://localhost:5173` | dùng trong link email đặt lại mật khẩu |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | — | gửi email; không đặt thì email in ra console |
| `AUTH_RATE_LIMIT` | `20` | đăng nhập/đăng ký/đặt lại mật khẩu mỗi 15 phút / IP |
| `SUGGEST_RATE_LIMIT` | `60` | gợi ý tìm kiếm mỗi phút / IP |
| `COMIC_CREATE_RATE_LIMIT` | `10` | truyện mới mỗi giờ / tài khoản |
| `PUBLISH_*`, `BULK_*`, `REQUEST_TIMEOUT_MS` | | xem [publishing-api.md](backend/docs/publishing-api.md#4-biến-môi-trường) |

## 5. Tài liệu

| Tài liệu | Nội dung |
|---|---|
| [backend/instruction.md](backend/instruction.md) | kiến trúc backend: tầng Route → Controller → Service → Repository, xử lý lỗi, transaction, test, checklist thêm tính năng |
| [backend/docs/api-conventions.md](backend/docs/api-conventions.md) | quy ước REST: xác thực, versioning, URL, status code, lỗi RFC 9457, phân trang, OpenAPI |
| [backend/docs/orm-sequelize.md](backend/docs/orm-sequelize.md) | Sequelize: model, truy vấn, transaction, thêm bảng/cột |
| [backend/docs/security-and-bugfix-changes.md](backend/docs/security-and-bugfix-changes.md) | các lớp bảo mật và 20 lỗi đã sửa |
| [backend/docs/publishing-api.md](backend/docs/publishing-api.md) | API đăng truyện bằng script, nhập hàng loạt |
| [frontend/README.md](frontend/README.md) | cấu trúc và quy ước frontend |
| [FEATURES-PLAN.md](FEATURES-PLAN.md) | lộ trình tính năng cho người đọc (xếp hạng, gợi ý, chặn, bookmark...) |
| [comic-translation/README.md](comic-translation/README.md) | pipeline dịch truyện |
| [TECHNIQUES.md](TECHNIQUES.md) | tổng kết kỹ thuật, kiến trúc, tiêu chuẩn |
| `http://localhost:5000/api/docs` | tài liệu API tương tác (Swagger UI) |

## 6. Vai trò người dùng

| Role | Được làm |
|---|---|
| khách | đọc truyện, xem bình luận, bảng xếp hạng, tìm kiếm |
| `user` | + theo dõi, chấm điểm, bình luận, lịch sử đọc, gợi ý cá nhân, chặn người dùng, báo cáo vi phạm, xin làm contributor |
| `contributor` | + Studio: tạo truyện, đăng chapter, API key cho Publishing API |
| `moderator` | + duyệt truyện/chapter, xử lý báo cáo, xoá bình luận |
| `admin` | + quản lý người dùng (role, ban), ẩn nội dung, cài đặt (auto-accept), nhập hàng loạt |
