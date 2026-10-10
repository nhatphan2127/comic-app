# ORM: Sequelize

Backend dùng **Express** (HTTP) + **Sequelize** (ORM) trên **SQLite**. Tài liệu này giải thích vì sao chọn Sequelize, code được tổ chức thế nào, và cách viết truy vấn mới.

## 1. Vì sao Sequelize

| Tiêu chí | Sequelize | Prisma | Drizzle |
|---|---|---|---|
| Viết bằng JS thuần, không cần bước `generate` | ✅ | ❌ (`prisma generate`) | ✅ |
| Transaction `async` trên SQLite | ✅ | ✅ | ❌ với `better-sqlite3` (transaction đồng bộ) |
| Test bằng DB `:memory:` tạo bảng từ model | ✅ `sync()` | Khó (cần chạy migration riêng) | Cần thư mục migration |
| Dùng lại driver `sqlite3` đang có, giữ nguyên file DB | ✅ | Phải khai báo lại kiểu ngày giờ | ✅ |
| Phổ biến trong các khoá học Express | ✅ | ✅ | Ít hơn |

## 2. Các file

```
src/config/database.js   ← tạo `sequelize`, withTransaction(), select(), now()
src/models/
├── columns.js           ← viết tắt cho cột: primaryId, ref('users'), timestamp()...
├── user.js              ← User, UserPreference, Session
├── comic.js             ← Comic, Author, Artist, Genre, Format, ComicGenre, ComicFormat, ComicOtherName, ComicContributor
├── chapter.js           ← Chapter, ChapterImage, ChapterContributor
├── interaction.js       ← ReadHistory, RatingHistory, FollowingCategory, Following
├── comment.js           ← ComicComment, ChapterComment (+ Reaction), sinh bởi cùng một hàm
├── system.js            ← Notification, AdminSetting, EditRequest, ModerationLog
└── index.js             ← quan hệ (belongsTo) + sequelize.sync() + export tất cả
```

`models/index.js` chạy `await sequelize.sync()` khi được import lần đầu: **tạo bảng còn thiếu, không sửa bảng đã có**. Vì vậy file `data/comic-platform.sqlite` hiện tại dùng tiếp được, không mất dữ liệu. Tên index được đặt trùng với schema cũ (`idx_comic_genres_comic`...) để `sync()` không tạo index thừa.

Hai lựa chọn có chủ ý trong model:
- **`timestamps: false`**: `createdAt`/`updatedAt` là cột TEXT mặc định `CURRENT_TIMESTAMP` (dạng `2026-10-07 16:12:23`), giống dữ liệu cũ. Khi cập nhật, repository tự đặt `updatedAt: now()`.
- **Khoá ngoại khai báo trên cột** (`ref('users')`), còn `belongsTo(..., { constraints: false })` trong `index.js` chỉ để JOIN. Nhờ vậy schema sinh ra giống hệt schema cũ.

## 3. Cách viết truy vấn

Repository luôn trả về **object thường** (`raw: true`), không trả instance của model, để service dùng như trước.

```js
// SELECT id FROM following WHERE userId = ? AND comicId = ?
Following.findOne({ attributes: ['id'], where: { userId, comicId }, raw: true });

// INSERT
Following.create({ id: uuidv4(), userId, comicId });

// UPDATE ... WHERE
Comic.update({ status, updatedAt: now() }, { where: { id } });

// DELETE
Following.destroy({ where: { userId, comicId } });

// IN (...), !=, >
Chapter.findAll({ where: { comicId: comicIds } });              // mảng = IN
Comic.findOne({ where: { url, id: { [Op.ne]: excludeId } } });
Comic.findAll({ where: { rating: { [Op.gt]: 0 } } });

// INSERT OR IGNORE
ComicGenre.bulkCreate(genreIds.map((genreId) => ({ comicId, genreId })), { ignoreDuplicates: true });

// INSERT ... ON CONFLICT DO UPDATE (chỉ cập nhật các trường được truyền vào)
ReadHistory.upsert({ userId, chapterId, readAt: now() });

// JOIN: lấy cột của bảng liên kết bằng col('<alias>.<cột>')
Session.findOne({
  attributes: ['id', 'userId', [col('user.role'), 'role']],
  include: [{ model: User, as: 'user', attributes: [], required: true }], // required = INNER JOIN
  where: { token },
  raw: true,
});
```

### Khi nào vẫn viết SQL

Một số truy vấn dạng báo cáo rõ ràng hơn khi viết SQL: CTE đệ quy (cây comment), `UNION` (comment của một user), nhiều subquery (danh sách đang theo dõi, lịch sử đọc), tìm kiếm có `EXISTS`. Chúng dùng `select()` trong `config/database.js`:

```js
select('SELECT ... WHERE c.url = ? LIMIT ?', [url, limit]);   // trả về mảng object
```

Giá trị luôn đi qua `?` (Sequelize escape). Không bao giờ ghép input của người dùng vào chuỗi SQL.

## 4. Transaction

```js
await withTransaction(async () => {
  await followRepo.insert({ userId, comicId });
  await comicRepo.incrementFollowCount(comicId);   // lỗi ở đây → INSERT phía trên bị rollback
});
```

Không cần truyền `tx`. [database.js](../src/config/database.js) đăng ký `AsyncLocalStorage` với `Sequelize.useCLS(...)`, nên mọi query chạy trong callback (kể cả trong hàm phụ, repository) tự động thuộc transaction. Request khác chạy song song không bị cuốn vào, vì mỗi luồng async có ngữ cảnh riêng.

Các transaction được xếp hàng (SQLite chỉ cho một transaction ghi tại một thời điểm), dùng `BEGIN IMMEDIATE`, và query ghi bị `SQLITE_BUSY` sẽ tự thử lại. **Không lồng `withTransaction`** (xem mục 4 trong [instruction.md](../instruction.md)).

## 5. Thêm bảng mới

1. Khai báo model trong file phù hợp ở `src/models/` (hoặc file mới), dùng các hàm trong `columns.js`.
2. Import và export nó trong `models/index.js`; thêm `belongsTo(...)` nếu cần JOIN.
3. Khởi động lại server: `sync()` tạo bảng.

`sync()` **không** thêm cột vào bảng đã có. Nếu cần thêm cột cho DB đang chạy, dùng `sequelize.getQueryInterface().addColumn(...)` một lần, hoặc chuyển sang migration (`sequelize-cli`) khi dự án lớn hơn.
