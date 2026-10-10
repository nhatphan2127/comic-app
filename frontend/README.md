# Frontend (Inkverse)

SPA viết bằng **React 19 + TypeScript**, build bằng **Vite**, điều hướng bằng **React Router 7**,
style bằng **CSS Modules**, icon từ `lucide-react`. Gọi backend qua REST API `/api/v1` (xem
[backend/docs/api-conventions.md](../backend/docs/api-conventions.md)).

## Lệnh

```bash
npm install
npm run dev        # http://localhost:5173, backend phải chạy ở http://localhost:5000
npm run build      # tsc -b (kiểm tra kiểu) rồi vite build → dist/
npm run preview    # chạy thử bản build (service worker chỉ bật ở bản build)
npm run lint       # oxlint
```

## Cấu trúc `src/`

```
src/
├── main.tsx, App.tsx      # điểm vào, khai báo route, đăng ký service worker (chỉ production)
├── pages/                 # một file mỗi trang: Home, Browse, MangaDetail, MangaReader, UserProfile,
│                          #   PublicProfile, ResetPassword, Studio, Admin, NotFound
├── layout/                # khung trang và các phần lớn: Header, Footer, MainLayout, MangaReaderLayout,
│                          #   Profile (các panel trong trang cá nhân)...
├── components/            # component dùng lại, mỗi component một thư mục (X.tsx + X.module.css)
├── console/               # "khung console" dùng chung cho Studio và Admin: layout, kiểm tra quyền,
│   └── ui/                #   trạng thái lọc trên URL (useQueryState), các UI nhỏ (StatCard, Toolbar...)
├── features/
│   ├── studio/            # các module của Studio (contributor, moderator), khai báo trong modules.ts
│   └── admin/             # các module của Admin console, khai báo trong modules.ts
├── services/api.ts        # MỌI lời gọi API nằm ở đây
├── types/types.ts         # kiểu dữ liệu dùng chung (Comic, Chapter, Comment, UserProfile...)
├── context/               # AuthContext (người dùng hiện tại), ThemeContext, ToastContext
├── hooks/                 # useClickOutside, useContentFilter, useInstallPrompt
├── helpers/               # hàm thuần: định dạng ngày, quyền theo role, URL ảnh, cx (ghép className)...
├── constants/             # danh sách lựa chọn của form truyện
├── config/brand.ts        # tên và tagline sản phẩm: đổi tên app ở đây
└── assets/emojis/         # ~1.9k ảnh emoji cho bình luận (không bị inline vào bundle, xem vite.config.ts)
```

| Route | Trang |
|---|---|
| `/` | trang chủ: carousel, xếp hạng, "You might like", đọc tiếp, mới cập nhật |
| `/browse` | duyệt và lọc truyện (`?search=` từ ô tìm kiếm) |
| `/comics/:comicUrl` | chi tiết truyện, truyện tương tự, bình luận |
| `/comics/:comicUrl/:chapterId` | trình đọc |
| `/profile` | trang cá nhân (cần đăng nhập), tab chọn bằng `?tab=` |
| `/users/:userId` | hồ sơ công khai |
| `/studio/*`, `/admin/*` | hai console, mỗi module được tải lười (`React.lazy`) |

## Quy ước

- **Gọi API:** chỉ qua `services/api.ts`. Hàm `send()` gửi `credentials: 'include'` (phiên nằm trong cookie
  HttpOnly do backend đặt, frontend không bao giờ thấy token), đọc lỗi dạng RFC 9457 (`detail`) thành
  `ApiError`, và phát sự kiện `auth-expired` khi phiên hết hạn để `AuthContext` đăng xuất.
- **Kiểu:** khai báo trong `types/types.ts`, không dùng `any` cho dữ liệu từ API.
- **Thêm module vào Studio/Admin:** tạo thư mục trong `features/studio` (hoặc `features/admin`) rồi thêm
  **một mục** vào `modules.ts` (đường dẫn, nhãn, icon, quyền `access`, component lazy, `badge` tuỳ chọn).
  Khung console tự lo menu, kiểm tra quyền và route.
- **Bộ lọc của danh sách trong console** lưu trên URL bằng `useQueryState`, nên tải lại trang hay gửi link vẫn giữ.
- **Style:** CSS Modules cạnh component; màu theo theme bằng biến CSS (`ThemeContext`).
- **Thư viện nặng tải khi cần:** `fflate` (nén zip trong trình duyệt ở module *Comic folders*) dùng `import()` động.

## PWA

`public/manifest.webmanifest` + `public/sw.js` cho phép cài app và dùng khi mạng yếu:

| Loại request | Chiến lược cache |
|---|---|
| Trang HTML | network first, mất mạng thì dùng app shell đã cache |
| `/assets/*` (có hash trong tên) | cache first |
| `/storage/*` (bìa, trang truyện) | cache first, tối đa 400 ảnh (bỏ ảnh cũ nhất) → chapter đã đọc mở được khi offline |
| API | không cache |

Đổi `VERSION` trong `sw.js` để xoá toàn bộ cache cũ ở lần truy cập sau.

## Còn lại

- `API_ORIGIN` đang cố định là `http://localhost:5000` trong `services/api.ts`; khi triển khai nên đọc từ
  biến môi trường của Vite (`import.meta.env.VITE_API_ORIGIN`).
- Proxy `/api` trong `vite.config.ts` không còn được dùng (frontend gọi thẳng backend), có thể xoá.
