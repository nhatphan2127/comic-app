# Hướng dẫn: Test + tách tầng Service/Repository + DRY

Tài liệu này giải thích những gì vừa được áp dụng vào backend, tại sao làm vậy, và cách bạn làm tiếp cho các tính năng mới. Đọc theo thứ tự từ trên xuống.

Phần bảo mật và transaction làm trước đó nằm ở [docs/security-and-bugfix-changes.md](docs/security-and-bugfix-changes.md).
ORM (Sequelize): [docs/orm-sequelize.md](docs/orm-sequelize.md).
**URL, status code, phân trang/lọc/sắp xếp, versioning `/api/v1` và tài liệu OpenAPI: [docs/api-conventions.md](docs/api-conventions.md).** Các ví dụ URL cũ trong file này (`/moderator/...`, `/user/...`) đã được thay; bảng đổi URL nằm ở mục 6 của tài liệu đó.

---

## 0. Tóm tắt nhanh

| Trước | Sau |
|---|---|
| Không có test nào | 48 test lúc tách tầng; **hiện 146 test / 19 file** (Vitest + supertest), chạy bằng `npm test` |
| Controller vừa đọc `req`, vừa xử lý nghiệp vụ, vừa viết SQL | Route → Controller → Service → Repository → DB, mỗi tầng một việc |
| `comicController.js` 885 dòng | 91 dòng; nghiệp vụ nằm ở `comicService` / `chapterService` / `contributorService` |
| Comment truyện và comment chapter: 12 handler, 12 route | 6 handler, 6 route, 1 repository dùng chung |
| Mỗi handler tự viết `try/catch` và `res.status(404).json(...)` | Service `throw new NotFoundError(...)`, `asyncHandler` + `errorMiddleware` lo phần còn lại |
| Mọi route được mount 2 lần (`/x` và `/api/x`) | Mount 1 lần |
| `follow`, `rate`, react comment không có transaction | Có transaction trong service |
| `rateComic` tải mọi rating rồi tính trung bình bằng JS | `SELECT AVG(rating)` |

Dọn thêm: bỏ `console.log(commentsTree)`, đổi `childCommment` → `childComment`, xoá `models/commentModel.js` (không ai import), xoá `uploadController.js` + `uploadRoutes.js` (frontend không dùng), gộp `getOrCreateEntity` + `normalizeValues`.

---

## 1. Vì sao viết test TRƯỚC khi refactor

Refactor nghĩa là đổi cấu trúc code mà **không đổi hành vi**. Nếu không có test, bạn không biết hành vi có bị đổi hay không. Nên thứ tự làm là:

1. Viết test trên code cũ, chạy cho xanh. Test lúc này mô tả hành vi hiện tại.
2. Refactor từng nhóm chức năng: interaction → auth/user → comment → comic → admin → notification.
3. Sau mỗi nhóm, chạy lại `npm test`. Xanh thì làm nhóm tiếp theo, đỏ thì sửa ngay khi thay đổi còn nhỏ.

Khi làm theo cách này, cả quá trình refactor không có lúc nào test bị đỏ ngoài dự kiến. Hai test đỏ duy nhất trên code cũ là hai test cố ý dùng tên mới `childComment`; chúng xanh khi đổi tên.

### Test được dựng thế nào

Để supertest gọi được app mà không mở cổng mạng, và để test không đụng vào DB thật, có 4 thay đổi nhỏ:

| Thay đổi | File | Lý do |
|---|---|---|
| Tách `app.js` (tạo app, `export default app`) khỏi `server.js` (chỉ `listen`) | [src/app.js](src/app.js), [src/server.js](src/server.js) | supertest nhận `app` và tự chạy nó, không cần cổng |
| `DB_PATH` lấy từ biến môi trường | [src/config/database.js](src/config/database.js) | Test dùng `:memory:`: DB nằm trong RAM, tự mất khi test xong |
| `STORAGE_ROOT` lấy từ biến môi trường | [src/middlewares/uploadMiddleware.js](src/middlewares/uploadMiddleware.js) | Ảnh upload trong test ghi vào thư mục tạm, không vào `storage/` |
| `AUTH_RATE_LIMIT` lấy từ biến môi trường | [src/app.js](src/app.js) | Test đăng ký và đăng nhập hàng chục lần, sẽ chạm giới hạn 20 lần |

Các biến này được đặt trong [vitest.config.js](vitest.config.js). Vitest chạy mỗi file test trong một môi trường module riêng, nên **mỗi file test có một DB in-memory riêng**, sạch từ đầu.

[tests/helpers.js](tests/helpers.js) có các hàm dựng dữ liệu: `createUser(role)`, `createComic(owner)`, `createChapter(owner, comicId)`, `auth(user)`.

### Các file test

| File | Kiểm tra |
|---|---|
| [auth.test.js](tests/auth.test.js) | Validate đăng ký; mật khẩu lưu dạng bcrypt; sai mật khẩu → 401; user bị ban không đăng nhập được và token cũ bị vô hiệu; logout |
| [authorization.test.js](tests/authorization.test.js) | Contributor không tự duyệt bài được; contributor không sửa truyện của người khác; đổi mật khẩu phải đúng mật khẩu cũ; chặn upload SVG; admin không tự đổi role của mình |
| [comics.test.js](tests/comics.test.js) | `GET /comics` không tham số vẫn chạy, `totalPages` chỉ đếm truyện public; chapter ẩn không đọc được; route `/chapters/:id/contributors` chạy được |
| [interactions.test.js](tests/interactions.test.js) | Follow 2 lần chỉ đếm 1; không follow vào category của người khác; trung bình rating đúng; lịch sử đọc |
| [comments.test.js](tests/comments.test.js) | `describe.each(['comics','chapters'])`: **cùng một bộ test chạy cho cả hai loại comment**, bảo đảm sau khi gộp code chúng vẫn hành xử giống nhau |
| [admin.test.js](tests/admin.test.js) | Phân quyền admin; dashboard; ẩn truyện; auto-accept; duyệt chapter cập nhật cả contributor; ban comment; `/api` không còn; notification của ai người nấy thấy |
| [services.test.js](tests/services.test.js) | Gọi **thẳng service**, không qua HTTP; chứng minh `withTransaction` rollback khi bước sau lỗi |

```bash
cd backend
npm test            # chạy một lần
npm run test:watch  # chạy lại mỗi khi lưu file
```

---

## 2. Tầng Service là gì

Trước đây mỗi controller làm cả ba việc trong một hàm:

1. **HTTP**: đọc `req.params`, `req.body`, trả `res.status(...).json(...)`.
2. **Nghiệp vụ**: truyện có tồn tại không? category có phải của user này không? đã follow thì cập nhật, chưa thì tạo mới và tăng bộ đếm.
3. **Truy cập DB**: viết SQL.

Giờ ba việc được tách thành ba tầng:

```
Request
  │
  ▼
Route ─────────── chọn handler, gắn middleware (authenticateToken, requireRole, upload)
  │
  ▼
Controller ────── HTTP: đọc req, chuẩn hoá kiểu (Number, trim, mặc định), gọi service, gửi res
  │
  ▼
Service ───────── nghiệp vụ: kiểm tra quy tắc, kiểm tra quyền trên tài nguyên, mở transaction,
  │               throw AppError khi sai
  ▼
Repository ────── truy vấn qua model Sequelize (ORM). Không có quy tắc nghiệp vụ.
  │
  ▼
Model (src/models) → SQLite
```

| Tầng | Được biết | Không được biết |
|---|---|---|
| Controller | `req`, `res`, status code thành công | SQL, quy tắc nghiệp vụ |
| Service | Quy tắc nghiệp vụ, transaction, quyền | `req`, `res`, Express |
| Repository | SQL, tên bảng, tên cột | HTTP, quy tắc nghiệp vụ |

Quy tắc kiểm tra nhanh: **nếu trong controller có chữ `db` hay `SELECT`, hoặc trong service có chữ `req` hay `res`, là sai tầng.** Hiện không controller nào import `config/database.js`.

### Ví dụ: followComic trước và sau

**Trước** (trong `interactionController.js`, khoảng 30 dòng, không có transaction):

```js
export async function followComic(req, res, next) {
  try {
    const comic = await db.get('SELECT id FROM comics WHERE id = ?', [comicId]);
    if (!comic) return res.status(404).json({ status: 'fail', message: 'Comic not found' });
    // ... kiểm tra category bằng SQL ...
    await db.run(`INSERT INTO following ...`);
    await db.run(`UPDATE comics SET follow = follow + 1 ...`); // lỗi ở đây thì 2 bảng lệch nhau
    return res.json({ status: 'success', data: { isFollowing: true } });
  } catch (error) { next(error); }
}
```

**Sau**, chia thành 3 file:

```js
// repositories/followRepository.js: chỉ truy cập dữ liệu (qua model Following)
export const find = (userId, comicId) =>
  Following.findOne({ attributes: ['id'], where: { userId, comicId }, raw: true });
export const insert = ({ userId, comicId, categoryId }) =>
  Following.create({ id: uuidv4(), userId, comicId, followingCategoryId: categoryId });

// services/interactionService.js: chỉ có nghiệp vụ, không biết Express là gì
export async function followComic(userId, comicId, categoryId = null) {
  return withTransaction(async () => {
    await assertComicExists(comicId);                           // throw NotFoundError
    if (categoryId && !(await categoryRepo.findOwnedOrDefault(categoryId, userId))) {
      throw new NotFoundError('Following category not found');
    }
    if (await followRepo.find(userId, comicId)) {
      await followRepo.updateCategory(userId, comicId, categoryId);
    } else {
      await followRepo.insert({ userId, comicId, categoryId });
      await comicRepo.incrementFollowCount(comicId);            // cùng transaction với INSERT
    }
    return { isFollowing: true };
  });
}

// controllers/interactionController.js: chỉ có HTTP
export const followComic = asyncHandler(async (req, res) => {
  const data = await interactionService.followComic(req.user.id, req.params.comicId, req.body?.categoryId || null);
  ok(res, data);   // utils/http.js: 200 { data }
});
```

### Tách ra như vậy được lợi gì

- **Test được mà không cần server.** [tests/services.test.js](tests/services.test.js) gọi `interactionService.followComic(userId, comicId)` trực tiếp, nhanh và hẹp hơn test HTTP.
- **Dùng lại được.** Ví dụ `moderationService.review()` phục vụ cả `PATCH /moderation/comics/:id` lẫn `PATCH /moderation/chapters/:id`. Trước đây là 3 bản copy, và 2 trong số đó không có transaction.
- **Transaction có chỗ đặt rõ ràng.** Transaction là quy tắc nghiệp vụ ("hai thao tác này phải cùng thành công"), nên nằm ở service.
- **Kiểm tra quyền có chỗ đặt rõ ràng.** Quy tắc như "contributor chỉ sửa được truyện của mình" nằm trong [services/permissions.js](src/services/permissions.js) và được gọi từ service, nên không bị quên ở route nào.
- **Dễ đổi DB.** Chuyển sang Postgres hay Prisma chỉ phải sửa tầng repository.

---

## 3. Luồng xử lý lỗi: AppError → asyncHandler → errorMiddleware

Service không biết `res`, vậy làm sao trả về 404? Câu trả lời: **lỗi mang sẵn status code**.

[src/errors.js](src/errors.js):

```js
export class AppError extends Error {
  constructor(message, status = 500) { super(message); this.status = status; }
}
export class NotFoundError extends AppError { constructor(m) { super(m, 404); } }
// BadRequestError 400, UnauthorizedError 401, ForbiddenError 403, ConflictError 409
```

Đường đi của một lỗi:

```
service:      throw new NotFoundError('Comic not found')
                │  (promise bị reject)
                ▼
asyncHandler: .catch(next)            ← src/utils/asyncHandler.js
                │
                ▼
errorMiddleware: status = err.status (404)
                 message = err.message nếu < 500, "Internal server error" nếu ≥ 500
                 → 404, Content-Type: application/problem+json
                   { type, title: 'Not Found', status: 404, detail: 'Comic not found', instance }  (RFC 9457)
```

**Vì sao cần `asyncHandler`?** Express 4 không tự bắt lỗi từ hàm `async`. Nếu handler async throw mà không ai `catch`, request sẽ treo. Trước đây mỗi handler tự viết `try { ... } catch (e) { next(e) }`. Giờ wrapper 3 dòng làm việc đó một lần cho tất cả:

```js
export default function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}
```

**Lỗi không phải AppError** (ví dụ lỗi SQL) không có `status`, nên thành 500 và thông báo bị che. Client không thấy chi tiết nội bộ. `errorMiddleware` chỉ `console.error` lỗi ≥ 500; lỗi 4xx là chuyện bình thường, log ra chỉ gây nhiễu.

`authMiddleware` và `requireRole` cũng chuyển sang dùng `next(new UnauthorizedError(...))`, nên mọi response lỗi đều đi qua cùng một chỗ.

---

## 4. Quy ước repository và transaction

### Transaction tự lan truyền, repository không cần tham số `db`

Repository dùng model Sequelize (xem [docs/orm-sequelize.md](docs/orm-sequelize.md)). Mọi query chạy bên trong `withTransaction(async () => { ... })` **tự động** thuộc transaction đó, kể cả query nằm sâu trong hàm phụ:

```js
await followRepo.find(userId, comicId);            // ngoài transaction
await withTransaction(async () => {
  await followRepo.find(userId, comicId);          // cùng hàm, nhưng chạy trong transaction
});
```

Cơ chế: [src/config/database.js](src/config/database.js) đăng ký `AsyncLocalStorage` với `Sequelize.useCLS(...)`, nên Sequelize biết "transaction hiện tại" của từng luồng async mà không cần truyền `{ transaction: t }` tay.

### Quy tắc: không lồng `withTransaction`

`withTransaction` (trong [src/config/database.js](src/config/database.js)) xếp các transaction vào hàng đợi, vì SQLite chỉ cho một transaction ghi tại một thời điểm. Nếu bên trong một transaction bạn gọi một hàm khác cũng mở `withTransaction`, transaction trong sẽ đứng chờ transaction ngoài kết thúc. Transaction ngoài lại đang chờ transaction trong, nên **treo vĩnh viễn**.

Vì vậy:
- Chỉ **hàm service cấp ngoài cùng** được mở transaction.
- Hàm phụ dùng bên trong transaction (ví dụ `initialReviewStatus()` trong [settingsService.js](src/services/settingsService.js)) **không** tự mở transaction; chúng tự động chạy trong transaction của hàm gọi.

### Đặt kiểm tra vào trong transaction

Ví dụ `comicService.create`: kiểm tra "URL đã tồn tại chưa" nằm **trong** transaction, cùng với câu `INSERT`. Nếu đặt ngoài, hai request cùng lúc có thể cùng thấy "chưa tồn tại" rồi cùng insert. Lỗi này gọi là race condition, kiểu *check-then-act*. Transaction `BEGIN IMMEDIATE` giữ khoá ghi nên hai bước không bị chen ngang.

---

## 5. Gộp code trùng (DRY)

### 5.1. Comment truyện và comment chapter

Hai bảng `comic_comments` và `chapter_comments` có cấu trúc giống hệt nhau, chỉ khác tên bảng và tên cột khoá ngoại. Bạn đã chọn **gộp ở tầng code** (giữ 2 bảng), nên [commentRepository.js](src/repositories/commentRepository.js) dùng một bảng tra cứu:

```js
const TARGETS = {
  comic:   { Comment: ComicComment,   Reaction: ComicCommentReaction,   table: 'comic_comments',   fk: 'comicId',   ... },
  chapter: { Comment: ChapterComment, Reaction: ChapterCommentReaction, table: 'chapter_comments', fk: 'chapterId', ... },
};

export const updateContent = (type, id, content) =>
  target(type).Comment.update({ content, updatedAt: now() }, { where: { id } });
```

Hai model cũng được tạo bởi cùng một hàm `defineComments(...)` trong [models/comment.js](src/models/comment.js).

**Vì sao các câu SQL thô (cây comment) ghép tên bảng vào chuỗi mà không bị SQL injection?** Dấu `?` chỉ thay được **giá trị**, không thay được tên bảng hay tên cột. Nên tên bảng buộc phải ghép vào chuỗi. Điều này an toàn **chỉ vì** tên bảng lấy từ `TARGETS` cố định trong code, không bao giờ lấy từ input. `type` không hợp lệ thì `target()` throw `BadRequestError`.

**Route** (từ khi có `/api/v1`): liệt kê và đăng comment nằm dưới tài nguyên cha, còn thao tác trên một comment dùng id của nó:

```js
// comicRoutes.js
comicRouter.get('/:comicId/comments', authenticateTokenOptional, comments.listComments('comic'));
chapterRouter.get('/:chapterId/comments', authenticateTokenOptional, comments.listComments('chapter'));
// commentRoutes.js: /comments/:commentId, /comments/:commentId/reaction
```

`listComments(type)` là factory (mục 5.2), nên hai loại comment dùng chung một handler. Bài học về cách Express khớp route vẫn đúng: tham số `:param` khớp **bất kỳ** đoạn URL nào, nên route cố định (`/comics/rankings`, `/comics/suggest`) phải khai báo **trước** `/comics/:comicId`.

Bộ test `describe.each(['comics', 'chapters'])` trong [comments.test.js](tests/comments.test.js) bảo đảm hai loại vẫn hành xử giống hệt nhau.

> Phương án còn lại là gộp ở tầng DB: một bảng `comments` có cột `targetType` + `targetId` (gọi là *polymorphic association*). Cách này sạch hơn nhưng mất khoá ngoại thật (`targetId` không thể `REFERENCES` hai bảng cùng lúc) và cần migration dữ liệu. Hợp lý để làm khi học migration (bước 7).

### 5.2. Contributor và duyệt bài

`updateComicContributorStatus` / `updateChapterContributorStatus`, `getContributorsByComic` / `getContributorsByChapter`, hai nhánh `if` trong `reviewSubmission`, cùng `updateComicStatus` / `updateChapterStatus`: tất cả giờ dùng [contributorService.js](src/services/contributorService.js) và [moderationService.js](src/services/moderationService.js) với tham số `type`.

Ở controller, kỹ thuật dùng là **factory function**: một hàm trả về handler, với `type` được cố định sẵn:

```js
export const listContributors = (type) => asyncHandler(async (req, res) => { ... });
// routes:
comicRouter.get('/:comicId/contributors', ..., listContributors('comic'));
chapterRouter.get('/:chapterId/contributors', ..., listContributors('chapter'));
```

### 5.3. getOrCreateEntity + normalizeValues

Hai hàm làm cùng một việc: tìm theo tên, không có thì tạo. Giờ gộp thành [lookupRepository.js](src/repositories/lookupRepository.js): `findOrCreateByName(table, name)` và `findOrCreateMany(table, values)`. Hàm sau gọi lại hàm trước. `table` được đổi sang model qua một bảng tra cố định (`author` → `Author`...).

### 5.4. Middleware dùng chung cho cả router

[adminRoutes.js](src/routes/adminRoutes.js) có 9 route, route nào cũng lặp lại `authenticateToken, requireRole('admin')`. Giờ khai báo một lần:

```js
router.use(authenticateToken, requireRole('admin'));
```

Thêm route mới vào file này thì tự động được bảo vệ, không thể quên.

---

## 6. Lỗi được sửa trong lúc tách tầng

| Lỗi | Đã sửa ở | Test bắt nó |
|---|---|---|
| `followComic` / `unfollowComic`: INSERT và UPDATE bộ đếm không cùng transaction | `interactionService` | `services.test.js` (rollback), `interactions.test.js` |
| `rateComic`: tải mọi rating rồi tính trung bình bằng JS; không có transaction | `ratingRepository.averageForComic` (`SELECT AVG`), `upsert` bằng `ON CONFLICT` | `interactions.test.js` (3.5 rồi 4.5 khi chấm lại) |
| React comment: đổi reaction và bộ đếm likes/dislikes không cùng transaction; bộ đếm có thể âm | `commentService.react`, `adjustCounters` dùng `MAX(x + ?, 0)` | `comments.test.js` |
| `updateComicStatus` / `updateChapterStatus` không có transaction | Dùng chung `moderationService.review` | `admin.test.js` |
| `createUser`: INSERT user và INSERT preference không cùng transaction | `authService.register` | `auth.test.js` |
| `popularComics`: 1 query lấy genres cho **mỗi** truyện (N+1 query) | `listGenresForComics` lấy một lần cho cả danh sách | `comics.test.js` |
| `getMyComicContributions` trả `unread: undefined` vì không SELECT cột đó | `contributorRepository` | — |
| Chapter số 0 bị từ chối (`!chapterNumber` là true khi giá trị là 0) | `chapterService.create` | — |

**Bài học về N+1:** khi lặp qua danh sách N phần tử và mỗi phần tử chạy 1 query, bạn có tổng cộng 1 + N query. Cách sửa: lấy hết bằng `WHERE comicId IN (...)` rồi gom nhóm trong JS. Xem `getFollowingList` trong [userService.js](src/services/userService.js) và `listPopular` trong [comicService.js](src/services/comicService.js).

---

## 7. Cấu trúc thư mục mới

```
backend/
├── instruction.md            ← file này
├── vitest.config.js          ← biến môi trường cho test
├── src/
│   ├── app.js                ← tạo Express app (supertest dùng file này)
│   ├── server.js             ← chỉ app.listen()
│   ├── errors.js             ← AppError và các lớp con
│   ├── config/database.js    ← kết nối Sequelize, withTransaction, select (SQL thô)
│   ├── models/               ← model Sequelize (schema), index.js tạo bảng + quan hệ
│   ├── utils/                ← asyncHandler, http.js (ok/created/noContent), listQuery.js (page/sort/filter)
│   ├── helpers/helpers.js    ← buildCommentTree, normalizeContentRatings
│   ├── middlewares/          ← auth, upload, error
│   ├── routes/               ← URL → middleware → controller; index.js = router /api/v1
│   ├── docs/                 ← openapi.yaml + Swagger UI (/api/docs)
│   ├── controllers/          ← HTTP (mỏng, không import db)
│   ├── services/             ← nghiệp vụ, quyền, transaction
│   │   ├── permissions.js    ← isStaff, canManageComic
│   │   ├── settingsService.js← auto-accept
│   │   ├── authService.js    ← hash/verify mật khẩu, register, login, session
│   │   ├── userService.js    ← profile, password, following, category, history
│   │   ├── interactionService.js
│   │   ├── commentService.js
│   │   ├── comicService.js · chapterService.js · contributorService.js
│   │   ├── moderationService.js · adminService.js · notificationService.js
│   └── repositories/         ← truy vấn qua model, mỗi file ứng với một bảng hoặc một nhóm bảng
└── tests/
```

Các file đã xoá: `models/userModel.js` (chuyển sang `userRepository` + `authService`), `models/commentModel.js` (code chết), `helpers/dbhelper.js` (chuyển sang `sessionRepository` + `authService.resolveSession`), `controllers/uploadController.js`, `routes/uploadRoutes.js`.

`scripts/seed.js` giờ import `hashPassword` từ `src/services/authService.js`.

---

## 8. Thay đổi ở frontend

| File | Thay đổi |
|---|---|
| [frontend/src/services/api.ts](../frontend/src/services/api.ts) | Bỏ tiền tố `/api` ở 15 lời gọi `request(...)` (notification, contribution, moderator, admin). Hai lời gọi `fetch('/api/comments/...')` trước đây đi qua proxy của Vite, giờ dùng `${API_BASE_URL}/comments/...` như phần còn lại |
| [frontend/src/types/types.ts](../frontend/src/types/types.ts), [CommentItem.tsx](../frontend/src/components/CommentsSection/CommentItem.tsx) | `childCommment` → `childComment` |

`npx tsc --noEmit` ở frontend không báo lỗi. Proxy `/api` trong `frontend/vite.config.ts` giờ không còn dùng; có thể xoá khi tiện.

---

## 9. Checklist khi thêm một tính năng mới

Ví dụ: thêm "báo cáo comment vi phạm".

1. **Test trước**: thêm vào `tests/` một test mô tả hành vi mong muốn, kể cả trường hợp biên (không đăng nhập, ID sai, báo cáo comment của chính mình...). Chạy để thấy nó đỏ.
2. **Model** (nếu cần bảng mới): khai báo trong `src/models/`, export ở `models/index.js`. Khởi động lại server là bảng được tạo.
3. **Repository**: hàm truy vấn dùng model (`findAll`, `create`, `update`...). Không có `if` nghiệp vụ.
4. **Service**: kiểm tra quy tắc, `throw new XxxError(...)`. Nhiều bước ghi phải cùng thành công thì bọc `withTransaction(async () => { ... })`. Không import gì từ Express.
5. **Controller**: bọc bằng `asyncHandler`, lấy dữ liệu từ `req`, gọi service, `res.json(...)`. Không `try/catch`, không truy vấn DB.
6. **Route + tài liệu**: gắn `authenticateToken` / `requireRole` cho các route cần, và thêm operation vào `src/docs/openapi.yaml` (test sẽ đỏ nếu quên). Nhớ thứ tự: route cố định (`/user`) khai báo trước route có tham số (`/:id`), hoặc giới hạn tham số bằng regex.
7. Chạy `npm test` cho xanh.

---

## 10. Bước tiếp theo

| Việc | Trạng thái |
|---|---|
| Validation bằng schema (zod) thay cho kiểm tra rải rác trong service | ⬜ chưa làm |
| Migration có version | 🟡 tạm dùng `addColumnIfMissing` trong `models/index.js` (xem [docs/orm-sequelize.md](docs/orm-sequelize.md#6-thêm-cột-vào-bảng-đã-có)) |
| Cấu hình qua `.env` (`node --env-file=.env src/server.js`) + validate biến môi trường khi khởi động | ⬜ chưa làm; biến hiện có xem `docs/publishing-api.md` (mục 4) và `docs/security-and-bugfix-changes.md` (Khi triển khai) |
| `.gitignore` cho `backend/data` và `backend/storage` | ✅ xong |
| CI (GitHub Actions chạy `npm test`) | ⬜ chưa làm |
