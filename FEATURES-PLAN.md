# Kế hoạch tính năng cho người đọc

Tài liệu này để một session mới đọc và làm tiếp từ đầu đến cuối. Làm **theo thứ tự các phase**: phase sau dùng
dữ liệu phase trước tạo ra. Phase đã xong ghi lại **thiết kế cuối cùng như code đang chạy** (các quyết định
phát sinh khi làm đã gộp vào đây); phase chưa làm là bản kế hoạch.

| Phase | Tính năng | Ước lượng | Trạng thái |
|---|---|---|---|
| 1 | Đếm lượt xem + Bảng xếp hạng | nhỏ | ✅ `812beeb`, `bc9f562` |
| 2 | Gợi ý khi gõ tìm kiếm (không dấu) | nhỏ | ✅ `3303765`, `cf63c5d` |
| 3 | Gợi ý truyện: Content-based + User-based Collaborative Filtering (hybrid) | lớn | ✅ `70f6f25` … `4c16de8` |
| 4 | Chặn người dùng | vừa | ✅ `b1a3da7` |
| 5 | Bookmark + ghi chú trong chapter | vừa | ⬜ **làm tiếp** |
| 6 | Hẹn giờ phát hành chapter | vừa | ⬜ |
| 7 | Thống kê đọc cá nhân | vừa | ⬜ |

Tất cả trên nhánh `feat/reader-features`, mỗi phase một commit (hoặc vài commit nhỏ).

**Không làm:** nối pipeline dịch tự động, bình luận theo trang/khung tranh.
**Đã có sẵn, không làm lại:** đọc tiếp đúng trang (`read_history.currentPage`, `PUT /me/history/:chapterId`, `ContinueReading`).

---

## 0. Quy ước của codebase (bắt buộc theo)

- **Backend:** Express + Sequelize + SQLite, ESM. Tầng `routes → controllers → services → repositories → models`.
  Controller không có SQL; service không có `req/res`. Đọc [backend/instruction.md](backend/instruction.md) và
  [backend/docs/api-conventions.md](backend/docs/api-conventions.md) trước.
- **Lỗi:** `throw new NotFoundError(...)` v.v. (`src/errors.js`); handler bọc `asyncHandler`; trả bằng
  `ok / created / noContent` (`src/utils/http.js`); phân trang `parsePagination` + `pageMeta`, danh sách ngắn
  `parseLimit` (`src/utils/listQuery.js`).
- **Transaction:** `withTransaction` (query bên trong tự tham gia qua CLS). Không lồng `withTransaction`.
- **Bảng mới:** model trong `src/models/*.js`, export qua `src/models/index.js` (`sync()` tự tạo bảng thiếu).
  **Cột mới trên bảng cũ:** thêm `addColumnIfMissing(...)` trong `src/models/index.js`.
- **Thời gian:** text UTC `'YYYY-MM-DD HH:MM:SS'` (`now()` = `CURRENT_TIMESTAMP`); so sánh chuỗi phải đúng định dạng
  này. Ngày (day bucket) là `'YYYY-MM-DD'` UTC.
- **Nội dung người đọc thấy:** `READABLE` / `readableSql(alias)` trong `src/repositories/visibility.js`
  (đã duyệt + công khai + chưa xoá). Mọi danh sách cho người đọc phải lọc qua đây.
- **Bộ lọc nội dung:** `user_preferences.filter` = index lớn nhất được xem trong
  `['safe','suggestive','erotica','pornographic']`.
- **OpenAPI:** mọi route mới phải có trong `src/docs/openapi.yaml`, nếu không `tests/conventions.test.js` đỏ.
- **Test:** Vitest + supertest, mỗi file test có DB in-memory riêng. Helper trong `tests/helpers.js`:
  `createUser`, `createComic`, `createChapter`, `approve`, `auth(user)` (trả header `Cookie` + `Origin`, vì phiên
  nằm trong cookie và có kiểm tra CSRF). Test đếm file trong storage dùng `vi.hoisted` để có `STORAGE_ROOT`
  riêng (xem `tests/bulkImport.test.js`).
- **Frontend:** gọi API trong `frontend/src/services/api.ts`, kiểu trong `frontend/src/types/types.ts`, trang
  trong `pages/`, component trong `components/`. Kiểm tra bằng `npx tsc --noEmit -p tsconfig.app.json` và `npm run lint`.
- **Mỗi phase xong:** `cd backend && npm test` xanh, tsc + lint frontend sạch, commit riêng.

---

## Phase 1 — Đếm lượt xem + Bảng xếp hạng ✅

**Vấn đề ban đầu:** cột `comics.view` có nhưng không chỗ nào tăng nó.

### Đếm lượt xem (`chapterService.openForReading`, `repositories/viewRepository.js`)
- Bảng `comic_daily_views (comicId, day, views)`, khoá chính `(comicId, day)`, index `(day)`.
- Bảng `user_read_days (userId, day, chapters)`, khoá chính `(userId, day)` — dùng cho streak ở Phase 7.
- Người đã đăng nhập: chỉ tính 1 view nếu chưa mở chapter này **trong 30 phút gần nhất** (F5 không tăng view).
  `user_read_days` tăng ở lần đầu đọc một chapter trong ngày, độc lập với việc có tính view hay không.
- Khách: mỗi lần mở là một view.
- Khi tính view: `comics.view += 1` và upsert `comic_daily_views` (`ON CONFLICT ... DO UPDATE SET views = views + 1`).

### Bảng xếp hạng
- `GET /comics/rankings?period=day|week|month|all&contentRating=&page=&pageSize=` (công khai). `period` mặc định
  `week`, sai → 400. `day` = hôm nay, `week` = 7 ngày, `month` = 30 ngày gần nhất (UTC).
- `score = views + 5 × follow mới + 3 × số rating mới` trong khoảng; `all` dùng tổng `comics.view`, `comics.follow`.
  Truyện `score = 0` không được xếp hạng. Hoà điểm: `follow DESC, id`.
- Chỉ truyện readable. Item giống `GET /comics` + `rank`, `score`.
- Frontend: khung "Rankings" ở trang chủ với `Segmented` Ngày/Tuần/Tháng/Tất cả; HeroCarousel hiện truyện nhiều view nhất (`sort=-view`).
- Test: `tests/views.test.js`, `tests/rankings.test.js`.

---

## Phase 2 — Gợi ý khi gõ tìm kiếm ✅

- `GET /comics/suggest?q=&contentRating=` → tối đa 8 truyện `{ id, url, name, coverUrl, types, rating, latestChapter }`.
  `q` sau trim < 2 ký tự → `[]`; dài hơn 100 → 400. Rate limit 60 / phút / IP (`SUGGEST_RATE_LIMIT`).
- Dùng chung điều kiện với `GET /comics?q=` (tên, url, tên khác, tác giả, hoạ sĩ), chỉ lấy cột nhẹ. Thứ tự:
  khớp tên chính xác → tên bắt đầu bằng q → còn lại theo `view DESC`.
- **Tìm không dấu, không phân biệt hoa thường** (cả `suggest` lẫn `GET /comics?q=`): "kiem than" ra "Kiếm Thần".
  - Cột `comics.searchText` = tên · url · tên khác · tác giả · hoạ sĩ đã bỏ dấu + chữ thường, ngăn bằng `char(31)`,
    tên đứng đầu để xét "khớp chính xác" / "bắt đầu bằng".
  - **Trigger SQLite** cập nhật cột khi `comics`, `comic_other_names`, `author`, `artist` đổi, nên mọi đường ghi
    (service, `seed.js`, SQL tay) đều đúng. Khởi động server tạo lại trigger và tính lại toàn bộ (`src/models/searchText.js`).
  - Phía truy vấn bỏ dấu `q` bằng cùng bảng ánh xạ trong JS (`foldText`); `%` và `_` người dùng gõ là ký tự thường (`LIKE ... ESCAPE`).
- Frontend: ô tìm kiếm ở header, debounce 250 ms, huỷ request cũ bằng `AbortController`, dropdown ảnh + tên + sao,
  phím ↑/↓/Enter/Esc; Enter không chọn → `/browse?search=`.
- Test: `tests/suggest.test.js`.

---

## Phase 3 — Gợi ý truyện (Hybrid: CBF + User-based CF) ✅

Code: `services/recommendationService.js` (hàm thuần + cache), `repositories/recommendationRepository.js`,
`tests/recommendations.test.js`, `scripts/evalRecommendations.js`; frontend `components/ComicShelf`, `components/ForYou`.

### 3.1 Độ "thích" ngầm định w(u, i)
Không đủ rating, nên ghép tín hiệu ngầm (implicit feedback):

```
w(u,i) = 3 · [u follow i]
       + 2 · min(số chapter khác nhau của i u đã đọc, 10) / 10
       + (rating(u,i) − 3)        nếu u đã rate (1..5), ngược lại 0
w(u,i) = max(w, 0)
```
`rating ≤ 2` = **không thích**. Nguồn: `following`, `read_history` (đếm theo comicId), `rating_history`; chỉ truyện readable.

### 3.2 Content-based Filtering (CBF)
- Vector truyện `x_i`: one-hot của genres + formats + demographic + type, trọng số **IDF = `ln(N / n_f)`**,
  chuẩn hoá L2. Đặc trưng có ở mọi truyện có IDF = 0 (không mang thông tin); đặc trưng hiếm ("Wuxia") nặng hơn đặc trưng phổ biến ("Action").
- Hồ sơ user `p_u = Σ w(u,i)·x_i − 0.5 · Σ x_j` (j = truyện không thích).
- `score_cb(u,i) = cos(p_u, x_i)`, chỉ giữ khi **≥ 0.2** (`MIN_CONTENT_SCORE`): thà ít truyện mà đúng.
- **Truyện tương tự** (không cá nhân hoá): `GET /comics/:comicId/similar?limit=&contentRating=` (id hoặc slug;
  limit 1..30, mặc định 10) = top `cos(x_i, x_j)`, bỏ cos = 0, item kèm `similarity`. Hiện ở `MangaDetail`.

### 3.3 User-based Collaborative Filtering (CF)
1. `I_u` = truyện u có w > 0; rỗng → cold start (3.5).
2. Ứng viên láng giềng: user khác có tương tác với ít nhất 1 truyện trong `I_u` (tối đa 500 người tương tác nhiều nhất).
3. `sim(u,v) = cos(w_u, w_v) × min(chung, 5) / 5` (significance weighting); bỏ v có < 2 truyện chung hoặc sim < 0.1.
4. K = 30 láng giềng gần nhất.
5. `score_cf(u,i) = Σ_{v ∈ N(u), w(v,i) > 0} sim(u,v) · w(v,i)`, chỉ giữ i có ≥ 2 láng giềng ủng hộ.
   Dùng **tổng**, không chia `Σ sim` như công thức dự đoán rating: để chọn top-N, truyện nhiều láng giềng thích
   phải thắng truyện ít người thích nhiều. Đánh giá offline: Precision@10 của CF 0.03 (trung bình) → 0.16 (tổng).

### 3.4 Kết hợp và lọc
- Mỗi điểm chia cho max trong danh sách ứng viên → [0,1]; `score = α·cf + (1 − α)·cb`, `α = min(0.7, |N(u)| / 20)`
  (ít láng giềng thì tin CBF hơn).
- Loại: truyện u đã tương tác (follow, đọc, rate bất kỳ), không readable, `contentRating` vượt bộ lọc của u.
- Đa dạng hoá: re-rank tham lam, không quá 3 truyện liên tiếp cùng "genre chính" (genre phổ biến nhất của truyện).
- Mỗi item có `reason`: `{ type: 'similar_readers', count }` (CF trội) hoặc `{ type: 'because_you_liked', comic }` (CB trội).

### 3.5 Cold start
- User chưa có tương tác: bảng xếp hạng tuần, `reason: { type: 'trending' }`, `score = 0`. Danh sách ngắn **không**
  được bù bằng trending.
- Truyện mới chưa ai đọc: chỉ CBF đẩy lên được (lý do dùng hybrid).

### 3.6 API, hiệu năng, giao diện
- `GET /me/recommendations?limit=` (1..50, mặc định 20) → item như `GET /comics` + `score` + `reason`.
- Tính khi gọi. Cache theo user 15 phút; vector truyện + IDF cache toàn cục 15 phút. Xoá cache của u khi u
  follow/unfollow, rate/bỏ rate, mở chapter lần đầu, hoặc đổi bộ lọc nội dung.
- Giao diện: khu "You might like" ở trang chủ (khi đăng nhập, không hiện lý do), thẻ giống "Latest updates",
  kéo chuột để cuộn, có nút < >.

### 3.7 Đánh giá offline
`node backend/scripts/evalRecommendations.js` (600 user giả, 400 truyện, seed 42), giấu 20% tương tác của mỗi user:

| Phương pháp | Precision@10 | Recall@10 |
|---|---|---|
| Popularity | 0.079 | 0.196 |
| CBF | 0.022 | 0.054 |
| CF | 0.157 | 0.378 |
| Hybrid | 0.143 | 0.346 |

Hybrid thấp hơn CF một chút vì trên dữ liệu giả này thể loại dự báo yếu; giá trị của CBF là truyện mới chưa ai đọc,
điều mà cách đánh giá "giấu tương tác" không đo được. Ngưỡng CBF 0.4 làm Hybrid giảm còn 0.131 nên giữ 0.2.

---

## Phase 4 — Chặn người dùng ✅

Code: `models/user.js` (`UserBlock`), `repositories/blockRepository.js`, `services/blockService.js`,
`tests/blocks.test.js`; frontend `layout/Profile/components/BlockedUsersPanel`.

- Bảng `user_blocks (blockerId, blockedId, createdAt)`, khoá chính `(blockerId, blockedId)`.
- API: `GET /me/blocks` (phân trang, kèm username/displayName/avatar); `PUT /me/blocks/:userId` và
  `DELETE /me/blocks/:userId` (204, idempotent; chính mình → 400, user không tồn tại → 404). Chặn được cả user bị ban.
- Hiệu lực (chỉ với người chặn):
  - Danh sách comment truyện + chapter bỏ comment của người bị chặn **và cả nhánh bên dưới**: lọc trong SQL bằng
    `notBlockedBy(column)` ở gốc lẫn bước đệ quy của CTE; `countRoots` dùng cùng điều kiện nên `totalItems` khớp.
  - `GET /comments/:id`: bỏ reply của người bị chặn; comment do người bị chặn viết → 404.
  - Không nhận thông báo khi người bị chặn trả lời mình.
  - Hồ sơ công khai vẫn xem được (`GET /users/:userId` trả `isBlocked`), hiện nút "Unblock".
  - Route `/moderation`, `/admin` không bị ảnh hưởng.
- Giao diện: "Block user" trong menu "…" của comment và của `PublicProfile`; tab "Blocked users" trong trang cá nhân
  (`?tab=blocked-users`).

---

## Phase 5 — Bookmark + ghi chú trong chapter ⬜

(Trong DB không còn bảng `bookmarks` cũ nào, nên tạo mới không bị đụng.)

- Bảng `bookmarks (id, userId, chapterId, pageNumber, note TEXT ≤ 500, createdAt, updatedAt)`, unique `(userId, chapterId, pageNumber)`.
- API:
  - `GET /me/bookmarks?comicId=&page=&pageSize=` — mới nhất trước, kèm tên truyện/chapter/url/ảnh trang; chỉ chapter readable (giống `historyRepository.listForUser`).
  - `PUT /me/bookmarks/:chapterId/pages/:pageNumber` body `{ note? }` → tạo (201) hoặc sửa (200). `pageNumber` phải trong `1..số trang` (400).
  - `DELETE /me/bookmarks/:chapterId/pages/:pageNumber` → 204.
  - `openForReading` trả thêm `metadata.bookmarks: [pageNumber...]` của người xem để trình đọc tô sáng.
- Giới hạn: 1000 bookmark / user (409 khi vượt).
- Frontend: nút bookmark trong `MangaReader.tsx` cho trang hiện tại (+ ô ghi chú), tab "Bookmarks" trong trang cá nhân, bấm vào mở đúng trang.
- Test: tạo/sửa/xoá, trang ngoài khoảng → 400, chapter bị ẩn không được liệt kê, người khác không sửa được bookmark của mình.

---

## Phase 6 — Hẹn giờ phát hành chapter ⬜

- Cột mới trên `chapters` (qua `addColumnIfMissing`): `publishAt TEXT NULL` (UTC `'YYYY-MM-DD HH:MM:SS'`), `announcedAt TEXT NULL`.
- **Readable** = như cũ **và** `(publishAt IS NULL OR publishAt <= CURRENT_TIMESTAMP)`: sửa ở **một chỗ**
  `visibility.js` (cả `READABLE` lẫn `readableSql`). `READABLE` là object Sequelize nên cần `[Op.or]`; kiểm tra mọi
  nơi spread `READABLE` không ghi đè khoá `[Op.or]`.
- Đầu vào: form Studio + publishing API nhận `publishAt` (ISO 8601 có múi giờ) → đổi sang UTC text. Phải ở tương lai,
  tối đa 1 năm (400). Sửa được khi chưa tới giờ.
- Thông báo người follow: hiện `notifyNewChapter` chạy lúc duyệt/auto-accept. Đổi thành: đã accept **và** đã tới giờ
  → gửi ngay và đặt `announcedAt`; chưa tới giờ → chưa gửi. `setInterval` 60 s **trong `server.js`** (không đặt ở
  `app.js` để test không chạy nó) gọi `chapterService.announceDueChapters()`: chapter accept, `publishAt <= now`,
  `announcedAt IS NULL` → gửi và đặt `announcedAt` trong transaction (không gửi hai lần).
- `GET /comics/:comicId/upcoming` → chapter đã duyệt nhưng chưa tới giờ `{ chapterNumber, title, publishAt }`
  (không trả ảnh). `MangaDetail.tsx` hiện "Chapter 13 — ra mắt 20:00 thứ Sáu" (giờ địa phương).
- Test: chapter hẹn giờ không đọc được / không có trong danh sách trước giờ (dùng `publishAt` quá khứ/tương lai,
  không chờ thật); `announceDueChapters` gửi đúng một lần; `publishAt` ở quá khứ khi tạo → 400.

---

## Phase 7 — Thống kê đọc cá nhân ⬜

- `GET /me/stats` →
  ```
  { chaptersRead, comicsRead, comicsFinished,       // finished = đã đọc chapter mới nhất của truyện đã kết thúc
    topGenres: [{ name, chapters }] (5),
    last30Days: [{ day, chapters }] (đủ 30 ngày, ngày trống = 0),
    streak: { current, longest },                    // ngày liên tiếp có đọc, theo user_read_days (UTC)
    since }                                          // ngày đầu tiên có dữ liệu
  ```
- Nguồn: `read_history` (tổng, thể loại qua `comic_genres`), `user_read_days` từ Phase 1. Ghi trong OpenAPI:
  dữ liệu theo ngày chỉ có **từ khi Phase 1 chạy**.
- Streak: `current` tính đến hôm nay hoặc hôm qua (chưa đọc hôm nay vẫn giữ chuỗi).
- Frontend: tab "Thống kê" trong trang cá nhân: thẻ số, biểu đồ cột 30 ngày, top thể loại (đọc skill `dataviz` trước khi vẽ).
- Test: dữ liệu giả trong `user_read_days` → streak đúng (có khoảng trống, có/không có hôm nay); `last30Days` đủ 30 phần tử; chỉ tính chapter readable.

---

## Checklist mỗi phase
- [ ] Model/cột mới + repository + service + controller + route
- [ ] `openapi.yaml` cập nhật (route, schema, lỗi 400/401/404/409/429 nếu có)
- [ ] Test backend mới, `npm test` xanh (chạy 2–3 lần để chắc không flaky)
- [ ] `api.ts` + `types.ts` + UI; `tsc` và `lint` sạch
- [ ] Commit riêng cho phase
