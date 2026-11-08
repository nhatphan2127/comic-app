# Khôi phục truyện từ ZIP (Admin)

Mở **Admin → Content → ZIP import** và chọn file ZIP theo cấu trúc thư mục dưới đây:

```text
library/
└── The Example Comic/
    ├── comic.json
    ├── cover.jpg
    ├── Chapter 1 - First Chapter/
    │   ├── 001.jpg
    │   └── 002.jpg
    └── Chapter 2/
        └── 001.webp
```

- Mỗi thư mục truyện có đúng một `comic.json` và một ảnh bìa tên `cover` với đuôi `.jpg`, `.jpeg`, `.png`, `.webp` hoặc `.gif`.
- Các thư mục chapter phải là thư mục con trực tiếp của thư mục truyện. Tên thư mục cần có số chapter; phần sau ` - ` được dùng làm tiêu đề nếu có. Trang được sắp xếp tự nhiên theo tên file (`2.jpg` trước `10.jpg`).
- `comic.json` dùng các trường truyện thông thường: `name`, `url` (tuỳ chọn), `type`, `contentRating`, `releaseStatus`, `releasingYear`, `description`, `source`, `author`, `artist`, `genres`, và `formats`. `genres` và `formats` nhận mảng hoặc chuỗi. Trường `id` bị bỏ qua; server tạo ID mới cho mọi truyện và chapter.
- URL truyện và URL chapter phải chưa tồn tại. ZIP có lỗi metadata, ảnh thiếu/hỏng, URL trùng hoặc file thiếu sẽ làm hủy toàn bộ batch.

Trình duyệt đọc ZIP để kiểm tra, gửi metadata trước, rồi tải từng ảnh riêng lẻ vào vùng staging riêng của backend. Không có request nào tải toàn bộ ZIP lên Nginx. Trước khi nhận đủ và xác thực mọi ảnh, backend không tạo bản ghi truyện/chapter và không ghi ảnh vào object storage. Khi commit, mọi bản ghi được tạo trong một transaction; nếu lưu dữ liệu thất bại, backend bù trừ các object đã ghi và giữ lại thông tin để thử dọn dẹp lại.

Body của `POST /admin/imports/{id}/commit` có thể gửi `{ "autoApprove": true | false }`: `true` duyệt luôn mọi truyện và chapter vừa import (`accept`), `false` đưa chúng vào hàng chờ duyệt (`pending`). Không gửi thì theo cài đặt auto-accept chung của site.

Giới hạn hiện tại: ZIP 2 GB, tối đa 20.000 entry, tổng giải nén 4 GB, `comic.json` tối đa 64 KB, mỗi ảnh tối đa 32 MB và tối đa 300 trang mỗi chapter. Chỉ nhận JPEG, PNG, WEBP và GIF; chữ ký file được kiểm tra trên server.
