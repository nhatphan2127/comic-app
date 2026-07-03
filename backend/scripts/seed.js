// scripts/seed.js

import db from '../src/config/database.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Định nghĩa thư mục lưu trữ ảnh tĩnh để đồng bộ cơ sở dữ liệu
const storagePath = path.join(__dirname, '..', 'storage');
const comicCoversDir = path.join(storagePath, 'comics');
const chapterImagesDir = path.join(storagePath, 'chapter-images');

// Tạo thư mục nếu chưa tồn tại
[comicCoversDir, chapterImagesDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

/**
 * Tạo một ảnh PNG 1x1 pixel trong suốt làm dự phòng để đảm bảo tiến trình ghi file mẫu mượt mà.
 */
function loadOrCreateDummyImage() {
  return Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
}

// 1. Danh sách 5 người dùng cố định theo yêu cầu hệ thống
const sampleUsers = [
  {
    displayName: 'Quản trị viên',
    username: 'admin',
    password: 'hashed_password_admin_123',
    email: 'admin@comicplatform.com',
    bio: 'Hệ thống quản trị viên toàn quyền tối cao.',
    role: 'admin',
  },
  {
    displayName: 'Tác giả Minh Tuấn',
    username: 'creator1',
    password: 'hashed_password_creator_1',
    email: 'minhtuan.creator@example.com',
    bio: 'Chuyên sáng tác các tác phẩm kiếm hiệp và tiên hiệp đô thị.',
    role: 'user',
  },
  {
    displayName: 'Studio Cánh Diều',
    username: 'creator2',
    password: 'hashed_password_creator_2',
    email: 'canhdieu.studio@example.com',
    bio: 'Nhóm dịch và sáng tác truyện tranh độc lập.',
    role: 'user',
  },
  {
    displayName: 'Nguyễn Văn Đọc',
    username: 'user1',
    password: 'hashed_password_user_1',
    email: 'vandoc.reader@example.com',
    bio: 'Một người đọc trung thành của thể loại Romance và Slice of Life.',
    role: 'user',
  },
  {
    displayName: 'Trần Thị Thư',
    username: 'user2',
    password: 'hashed_password_user_2',
    email: 'thithu.manga@example.com',
    bio: 'Manga là lẽ sống. Thức đêm cày truyện là đam mê.',
    role: 'user',
  },
];

// Danh sách dữ liệu mẫu để sinh ngẫu nhiên truyện tranh
const firstNames = ['Võ Thần', 'Đế Vương', 'Chuyển Sinh', 'Sát Thủ', 'Huyền Thoại', 'Bá Chủ', 'Học Viện', 'Thần Cấp', 'Siêu Cấp', 'Độc Cô', 'Kiếm Tôn', 'Ma Pháp', 'Hệ Thống', 'Tiên Tôn', 'Tu Tiên', 'Hành Trình', 'Cuộc Chiến', 'Bí Mật', 'Truyền Thuyết', 'Chúa Tể', 'Thợ Săn', 'Quỷ Vương', 'Chiến Thần', 'Đại Pháp Sư'];
const middleNames = ['Vô Song', 'Bất Bại', 'Chi Vương', 'Tu Tiên', 'Đô Thị', 'Hư Không', 'Bóng Tối', 'Ánh Sáng', 'Khởi Đầu', 'Hồi Sinh', 'Tối Thượng', 'Linh Giới', 'Hoàng Kim', 'Cổ Đại', 'Thiên Tài', 'Phế Vật', 'Nghịch Thiên', 'Mạt Thế', 'Tinh Không', 'Cực Hạn', 'Luân Hồi', 'Yêu Nghiệt', 'Huyết Tộc'];
const lastNames = ['Kỳ Truyện', 'Bản Kỷ', 'Vô Hạn', 'Trở Lại', 'Mới', 'Độc Nhất', 'Phần 2', 'Huyền Thoại', 'Chi Lộ', 'Đại Chiến', 'Nơi Đô Thị', 'Học Đường', 'Toàn Năng', 'Hệ Thống', 'Đỉnh Phong', 'Ký Sự', 'Chi Ca', 'Tranh Bá', 'Lục Địa', 'Thần Thoại', 'Vực Sâu', 'Phá Hoại', 'Trùng Sinh'];

const descStarts = [
  "Một câu chuyện kể về",
  "Sau khi bị phản bội bởi những người đồng đội tin tưởng nhất,",
  "Trong một thế giới nơi sức mạnh ma pháp quyết định tất cả,",
  "Được ban tặng một hệ thống tối thượng ngay từ khi sinh ra,",
  "Trở về quá khứ 10 năm trước khi thảm họa tận thế xảy ra,",
  "Là một kẻ bị coi là phế vật của một gia tộc tu chân cổ xưa,",
  "Bước ra từ vùng đất cấm kỵ cổ đại với sức mạnh tuyệt đối,"
];

const descMiddles = [
  "nhân vật chính bắt đầu cuộc hành trình rèn luyện đầy gian khổ,",
  "anh ta thề sẽ khiến những kẻ từng khinh rẻ và hãm hại mình phải trả giá đắt,",
  "với kiến thức đỉnh phong từ kiếp trước, anh nhanh chóng làm chủ các kỹ năng tối thượng,",
  "vượt qua mọi thử thách khắc nghiệt trong các ngục tối hoang dã nguy hiểm,",
  "thu nhập những ma thú huyền thoại vốn đã tuyệt chủng hàng ngàn năm,"
];

const descEnds = [
  "để chứng minh cho cả thế giới thấy ai mới là bá chủ thực sự.",
  "và từng bước leo lên đỉnh phong cao nhất của võ đạo.",
  "mở ra một kỷ nguyên hoàn toàn mới cho nhân loại.",
  "liệu anh có thể thay đổi được vận mệnh bi thảm của chính mình lần này?",
  "tạo nên một truyền thuyết bất hủ được người đời ca tụng muôn năm sau."
];

// Hàm chuyển đổi tiếng Việt có dấu sang slug URL không dấu
function slugify(text) {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

// Sinh danh sách truyện tranh mẫu (Mục tiêu sinh 92 bộ)
function generateSampleComics(count = 92) {
  const list = [];
  const titles = new Set();
  const slugs = new Set();

  const typesList = ['manga', 'manhwa', 'manhua', 'other'];
  const ratingList = ['safe', 'suggestive', 'erotica', 'pornographic'];
  const demoList = ['josei', 'seinen', 'shoujo', 'shounen'];
  const releaseStatusList = ['releasing', 'finished', 'on hiatus', 'discontinued'];

  for (let i = 1; i <= count; i++) {
    let title = '';
    let attempts = 0;

    while (attempts < 1000) {
      const f = firstNames[Math.floor(Math.random() * firstNames.length)];
      const m = middleNames[Math.floor(Math.random() * middleNames.length)];
      const l = lastNames[Math.floor(Math.random() * lastNames.length)];
      title = `${f} ${m} ${l}`;
      if (!titles.has(title)) {
        titles.add(title);
        break;
      }
      attempts++;
    }

    if (attempts >= 1000) {
      title = `Tuyệt Thế Thần Ma Số ${i}`;
    }

    let slug = slugify(title);
    if (slugs.has(slug)) {
      slug = `${slug}-${i}`;
    }
    slugs.add(slug);

    const types = typesList[Math.floor(Math.random() * typesList.length)];
    const contentRating = Math.random() > 0.8 ? ratingList[Math.floor(Math.random() * ratingList.length)] : 'safe';
    const demographic = demoList[Math.floor(Math.random() * demoList.length)];
    const releaseStatus = releaseStatusList[Math.floor(Math.random() * releaseStatusList.length)];

    const dStart = descStarts[Math.floor(Math.random() * descStarts.length)];
    const dMiddle = descMiddles[Math.floor(Math.random() * descMiddles.length)];
    const dEnd = descEnds[Math.floor(Math.random() * descEnds.length)];
    const description = `${dStart} ${dMiddle} ${dEnd}`;

    list.push({
      name: title,
      types,
      contentRating,
      demographic,
      description,
      releaseStatus,
      url: slug,
      releasingYear: Math.floor(Math.random() * 9) + 2018, // 2018 - 2026
    });
  }
  return list;
}

// Bình luận mẫu
const comicCommentTemplates = [
  'Truyện này hay quá, đọc một lèo hết luôn không nghỉ!',
  'Nét vẽ cực kỳ đẹp mắt, biểu cảm nhân vật rất chân thực.',
  'Cốt truyện bắt đầu hơi chậm nhưng sau chap 10 thì cuốn không chịu được.',
  'Tôi thấy main thông minh đấy, hành động dứt khoát.',
  'Bản dịch tiếng Việt mượt mà, cảm ơn nhóm dịch nhiều lắm nhé.',
];

const comicReplyTemplates = [
  'Chuẩn luôn bạn ơi, đồng quan điểm với bác!',
  'Cho mình hỏi lịch ra chap mới cố định là thứ mấy thế?',
  'Bên raw ra đến chap 50 rồi, chuẩn bị bùng nổ combat siêu to khổng lồ!',
];

async function seedDatabase() {
  try {
    console.log('🌱 Bắt đầu tiến trình dọn dẹp và nạp dữ liệu (SQLite Seeding)...');

    // 1. Dọn dẹp tất cả bảng theo trình tự khóa ngoại
    await db.exec(`
      DELETE FROM sessions;
      DELETE FROM notifications;
      DELETE FROM moderation_logs;
      DELETE FROM edit_requests;
      DELETE FROM chapter_comment_reactions;
      DELETE FROM comic_comment_reactions;
      DELETE FROM chapter_comments;
      DELETE FROM comic_comments;
      DELETE FROM following;
      DELETE FROM bookmarks;
      DELETE FROM following;
      DELETE FROM following_categories;
      DELETE FROM rating_history;
      DELETE FROM read_history;
      DELETE FROM chapter_images;
      DELETE FROM chapters;
      DELETE FROM comic_contributors;
      DELETE FROM comic_other_names;
      DELETE FROM comic_formats;
      DELETE FROM comic_genres;
      DELETE FROM comics;
      DELETE FROM formats;
      DELETE FROM genres;
      DELETE FROM artist;
      DELETE FROM author;
      DELETE FROM user_preferences;
      DELETE FROM users;
    `);
    console.log('🧹 Đã xóa sạch dữ liệu cũ trong các bảng thành công.');

    const dummyImageBuffer = loadOrCreateDummyImage();
    await db.run('BEGIN TRANSACTION');

    // ========== 2. NẠP BẢNG USERS & PREFERENCES ==========
    console.log('👥 Đang tạo 5 người dùng mẫu...');
    const userIds = {};
    const listUserIds = [];

    for (const user of sampleUsers) {
      const userId = uuidv4();
      userIds[user.username] = userId;
      listUserIds.push(userId);

      await db.run(
        `INSERT INTO users (id, avatar, displayName, username, password, email, bio, socialLinks, role)
         VALUES (?, NULL, ?, ?, ?, ?, ?, NULL, ?)`,
        [userId, user.displayName, user.username, user.password, user.email, user.bio, user.role]
      );

      await db.run(
        `INSERT INTO user_preferences (userId, theme, filter)
         VALUES (?, ?, ?)`,
        [userId, 'light', 1]
      );
    }

    // ========== 3. NẠP DANH MỤC THỰC THỂ (Authors, Artists, Genres, Formats) ==========
    console.log('🏷️  Đang nạp danh mục chuẩn hóa...');
    
    const authors = [
      { id: uuidv4(), name: 'Ngã Cật Tây Hồng Thị', bio: 'Tác giả tiên hiệp hàng đầu Trung Quốc.' },
      { id: uuidv4(), name: 'Đường Gia Tam Thiếu', bio: 'Tác giả của bộ Đấu La Đại Lục nổi tiếng.' },
      { id: uuidv4(), name: 'Eiichiro Oda', bio: 'Huyền thoại sáng tác One Piece.' },
      { id: uuidv4(), name: 'Chugong', bio: 'Tác giả tiểu thuyết mạng Solo Leveling.' },
      { id: uuidv4(), name: 'One', bio: 'Tác giả của One-Punch Man và Mob Psycho 100.' }
    ];
    for (const aut of authors) {
      await db.run(`INSERT INTO author (id, name, bio) VALUES (?, ?, ?)`, [aut.id, aut.name, aut.bio]);
    }

    const artists = [
      { id: uuidv4(), name: 'Murata Yusuke', bio: 'Họa sĩ thiên tài vẽ One Punch Man.' },
      { id: uuidv4(), name: 'Takeshi Obata', bio: 'Minh họa tuyệt đẹp cho Death Note.' },
      { id: uuidv4(), name: 'Inoue Takehiko', bio: 'Tác giả kiêm họa sĩ Vagabond, Slam Dunk.' },
      { id: uuidv4(), name: 'Jang Sung-rak', bio: 'Cố họa sĩ minh họa Solo Leveling xuất sắc.' }
    ];
    for (const art of artists) {
      await db.run(`INSERT INTO artist (id, name, bio) VALUES (?, ?, ?)`, [art.id, art.name, art.bio]);
    }

    const genresList = [
      { id: uuidv4(), name: 'Action', description: 'Hành động kịch tính' },
      { id: uuidv4(), name: 'Adventure', description: 'Phiêu lưu khám phá' },
      { id: uuidv4(), name: 'Comedy', description: 'Hài hước hóm hỉnh' },
      { id: uuidv4(), name: 'Drama', description: 'Chính kịch, sâu sắc' },
      { id: uuidv4(), name: 'Fantasy', description: 'Kỳ ảo, phép thuật' },
      { id: uuidv4(), name: 'Isekai', description: 'Chuyển sinh sang thế giới khác' },
      { id: uuidv4(), name: 'Martial Arts', description: 'Võ thuật, kiếm hiệp' },
      { id: uuidv4(), name: 'Romance', description: 'Lãng mạn, tình cảm' }
    ];
    for (const gen of genresList) {
      await db.run(`INSERT INTO genres (id, name, description) VALUES (?, ?, ?)`, [gen.id, gen.name, gen.description]);
    }

    const formatsList = [
      { id: uuidv4(), name: 'Manga', description: 'Truyện tranh Nhật Bản' },
      { id: uuidv4(), name: 'Manhwa', description: 'Truyện tranh Hàn Quốc' },
      { id: uuidv4(), name: 'Manhua', description: 'Truyện tranh Trung Quốc' },
      { id: uuidv4(), name: 'Webtoon', description: 'Truyện định dạng số' }
    ];
    for (const form of formatsList) {
      await db.run(`INSERT INTO formats (id, name, description) VALUES (?, ?, ?)`, [form.id, form.name, form.description]);
    }

    // ========== 4. NẠP TRUYỆN TRANH (COMICS - 92 BỘ) ==========
    const sampleComics = generateSampleComics(92);
    console.log(`📚 Đang khởi tạo ${sampleComics.length} truyện tranh ngẫu nhiên cùng các liên kết chuẩn hóa...`);
    const comicIds = [];
    const chapterIdsByComic = {};

    for (let i = 0; i < sampleComics.length; i++) {
      const comic = sampleComics[i];
      const comicId = uuidv4();
      comicIds.push(comicId);
      chapterIdsByComic[comicId] = [];

      const coverUrl = `comics/${comicId}.png`;
      const randomAuthor = authors[Math.floor(Math.random() * authors.length)];
      const randomArtist = artists[Math.floor(Math.random() * artists.length)];
      const randomRating = (Math.random() * 1.5 + 3.5).toFixed(1);

      // Lưu file ảnh tượng trưng
      try {
        fs.writeFileSync(path.join(comicCoversDir, `${comicId}.png`), dummyImageBuffer);
      } catch (err) {}

      // Thêm truyện
      await db.run(
        `INSERT INTO comics (
          id, name, types, contentRating, demographic, description, rating, coverUrl, 
          view, follow, releaseStatus, visibility, url, releasingYear, authorId, artistId
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'public', ?, ?, ?, ?)`,
        [
          comicId,
          comic.name,
          comic.types,
          comic.contentRating,
          comic.demographic,
          comic.description,
          parseFloat(randomRating),
          coverUrl,
          Math.floor(Math.random() * 150000) + 100,
          Math.floor(Math.random() * 9000) + 5,
          comic.releaseStatus,
          comic.url,
          comic.releasingYear,
          randomAuthor.id,
          randomArtist.id
        ]
      );

      // Gán Thể loại ngẫu nhiên (1-3 genres)
      const shuffledGen = [...genresList].sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * 3) + 1);
      for (const gen of shuffledGen) {
        await db.run(`INSERT INTO comic_genres (comicId, genreId) VALUES (?, ?)`, [comicId, gen.id]);
      }

      // Gán Định dạng ngẫu nhiên (1 format)
      const randomFormat = formatsList[Math.floor(Math.random() * formatsList.length)];
      await db.run(`INSERT INTO comic_formats (comicId, formatId) VALUES (?, ?)`, [comicId, randomFormat.id]);

      // Tên thay thế phụ
      await db.run(
        `INSERT INTO comic_other_names (id, comicId, name) VALUES (?, ?, ?)`,
        [uuidv4(), comicId, `Tên Khác Của ${comic.name}`]
      );

      // Người đăng đóng góp
      const contributorId = i % 2 === 0 ? userIds.creator1 : userIds.creator2;
      await db.run(
        `INSERT INTO comic_contributors (comicId, userId, role, status, unread, updatedAt) VALUES (?, ?, 'uploader', 'accept', 0, CURRENT_TIMESTAMP)`,
        [comicId, contributorId]
      );

      // ========== 5. NẠP CHƯƠNG TRUYỆN & ẢNH (CHAPTERS & IMAGES) ==========
      // Mỗi bộ truyện chứa từ 4 đến 8 chương độc lập
      const numChapters = Math.floor(Math.random() * 5) + 4;
      for (let j = 1; j <= numChapters; j++) {
        const chapterId = uuidv4();
        chapterIdsByComic[comicId].push(chapterId);

        await db.run(
          `INSERT INTO chapters (id, comicId, title, chapterNumber, visibility, url)
           VALUES (?, ?, ?, ?, 'public', ?)`,
          [
            chapterId,
            comicId,
            `Chương ${j}: Hành trình mới bắt đầu`,
            j,
            `${comic.url}-chuong-${j}`
          ]
        );

        // Mỗi chương chứa 4 trang ảnh
        for (let page = 1; page <= 4; page++) {
          const imageId = uuidv4();
          const imagePath = `chapter-images/${imageId}.png`;

          try {
            fs.writeFileSync(path.join(chapterImagesDir, `${imageId}.png`), dummyImageBuffer);
          } catch (err) {}

          await db.run(
            `INSERT INTO chapter_images (id, chapterId, urlPath, pageNumber)
             VALUES (?, ?, ?, ?)`,
            [imageId, chapterId, imagePath, page]
          );
        }

        // Thêm chapter_contributors
        await db.run(
          `INSERT INTO chapter_contributors (chapterId, userId, role, status, unread, updatedAt) VALUES (?, ?, 'contributor', 'accept', 0, CURRENT_TIMESTAMP)`,
          [chapterId, contributorId]
        );
      }
    }

    // ========== 6. NẠP CÁC LƯỢT TƯƠNG TÁC (Bookmarks, Follow, Rating, History) ==========
    console.log('❤️  Đang thiết lập quan hệ tương tác người dùng...');
    const defaultCategoryIds = {};
    const defaultCategoryNames = ['Reading', 'Completed', 'On-Hold', 'Plan to Read', 'Dropped'];
    for (const categoryName of defaultCategoryNames) {
      const categoryId = uuidv4();
      await db.run(
        `INSERT INTO following_categories (id, category, userId) VALUES (?, ?, NULL)`,
        [categoryId, categoryName]
      );
      defaultCategoryIds[categoryName] = categoryId;
    }

    for (const comicId of comicIds) {
      for (const userId of listUserIds) {
        // Tỷ lệ Follow: 40%
        if (Math.random() > 0.6) {
          const categoryName = defaultCategoryNames[Math.floor(Math.random() * defaultCategoryNames.length)];
          await db.run(
            `INSERT INTO following (id, userId, comicId, followingCategoryId) VALUES (?, ?, ?, ?)`,
            [uuidv4(), userId, comicId, defaultCategoryIds[categoryName]]
          );
        }

        // Tỷ lệ Bookmark: 30%
        if (Math.random() > 0.7) {
          await db.run(
            `INSERT INTO bookmarks (userId, comicId) VALUES (?, ?)` ,
            [userId, comicId]
          );
        }

        // Tỷ lệ Đánh giá: 40% (Từ 1 đến 5 sao)
        if (Math.random() > 0.6) {
          await db.run(
            `INSERT INTO rating_history (userId, comicId, rating) VALUES (?, ?, ?)` ,
            [userId, comicId, Math.floor(Math.random() * 5) + 1]
          );
        }
      }
    }

    // Lịch sử đọc (Read History)
    for (const userId of listUserIds) {
      // Đọc ngẫu nhiên 10 truyện khác nhau
      const shuffledComics = [...comicIds].sort(() => 0.5 - Math.random()).slice(0, 10);
      for (const comicId of shuffledComics) {
        const chaps = chapterIdsByComic[comicId];
        if (chaps && chaps.length > 0) {
          const readCount = Math.min(chaps.length, 3);
          for (let r = 0; r < readCount; r++) {
            await db.run(
              `INSERT OR IGNORE INTO read_history (userId, chapterId, scrollPosition, currentPage) VALUES (?, ?, ?, ?)`,
              [userId, chaps[r], Math.floor(Math.random() * 2000), Math.floor(Math.random() * 20) + 1]
            );
          }
        }
      }
    }

    // ========== 7. NẠP BÌNH LUẬN & PHẢN HỒI (Comments & Reactions) ==========
    console.log('💬 Đang xây dựng hệ thống bình luận và biểu cảm cảm xúc...');
    const allComicComments = [];

    for (const comicId of comicIds) {
      // Mỗi truyện có 2 bình luận gốc
      for (let c = 0; c < 2; c++) {
        const commentId = uuidv4();
        const authorId = listUserIds[Math.floor(Math.random() * listUserIds.length)];
        const content = comicCommentTemplates[Math.floor(Math.random() * comicCommentTemplates.length)];
        const likes = Math.floor(Math.random() * 20);
        const dislikes = Math.floor(Math.random() * 3);

        await db.run(
          `INSERT INTO comic_comments (id, comicId, userId, content, parentCommentId, likes, dislikes)
           VALUES (?, ?, ?, ?, NULL, ?, ?)`,
          [commentId, comicId, authorId, content, likes, dislikes]
        );
        allComicComments.push({ id: commentId, userId: authorId });

        // Bình luận phản hồi (1 phản hồi)
        const replyId = uuidv4();
        const replyAuthorId = listUserIds.find(id => id !== authorId) || authorId;
        const replyContent = comicReplyTemplates[Math.floor(Math.random() * comicReplyTemplates.length)];
        
        await db.run(
          `INSERT INTO comic_comments (id, comicId, userId, content, parentCommentId, likes, dislikes)
           VALUES (?, ?, ?, ?, ?, ?, 0)`,
          [replyId, comicId, replyAuthorId, replyContent, commentId, Math.floor(Math.random() * 5)]
        );
      }
    }

    // Thêm lượt bày tỏ cảm xúc Thích/Ghét (Comic Comment Reactions)
    for (const comm of allComicComments.slice(0, 50)) { // Tạo mẫu cho 50 bình luận đầu
      for (const userId of listUserIds) {
        if (Math.random() > 0.5) {
          const rType = Math.random() > 0.2 ? 'like' : 'dislike';
          await db.run(
            `INSERT OR IGNORE INTO comic_comment_reactions (userId, commentId, reactionType) VALUES (?, ?, ?)`,
            [userId, comm.id, rType]
          );
        }
      }
    }

    // ========== 8. THÔNG BÁO & PHIÊN HOẠT ĐỘNG (Notifications & Sessions) ==========
    console.log('🔔 Đang phân bổ thông báo và phiên hoạt động...');
    for (const userId of listUserIds) {
      // Mỗi user nhận 3 thông báo mẫu
      for (let n = 1; n <= 3; n++) {
        await db.run(
          `INSERT INTO notifications (id, userId, title, content, type, redirectPath, isRead)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            uuidv4(),
            userId,
            `Hệ thống nâng cấp`,
            `Hệ thống nền tảng truyện tranh vừa cập nhật thành công lên cấu trúc chuẩn hóa mới.`,
            `system`,
            `/`,
            Math.random() > 0.6 ? 1 : 0
          ]
        );
      }

      // Khởi tạo phiên
      await db.run(
        `INSERT INTO sessions (id, userId, token, expiresAt)
         VALUES (?, ?, ?, ?)`,
        [
          uuidv4(),
          userId,
          `token_demo_for_${userId.substring(0, 8)}`,
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        ]
      );
    }

    await db.run('COMMIT');
    console.log('\n✨ ĐÃ HOÀN THÀNH TIẾN TRÌNH NẠP DỮ LIỆU MẪU THÀNH CÔNG!');
    console.log(`📊 Tổng kết thực thể đã nạp:`);
    console.log(`   - Người dùng hệ thống: ${sampleUsers.length} tài khoản`);
    console.log(`   - Tác giả & Họa sĩ chuẩn hóa: ${authors.length} tác giả, ${artists.length} họa sĩ`);
    console.log(`   - Tổng bộ truyện độc lập: ${sampleComics.length} bộ truyện`);
    console.log(`   - Toàn bộ bình luận, biểu cảm, thông báo, mối quan hệ thực thể đã liên kết mượt mà.`);
    
    process.exit(0);
  } catch (error) {
    try {
      await db.run('ROLLBACK');
    } catch (e) {}
    console.error('❌ Đã xảy ra lỗi nghiêm trọng khi nạp dữ liệu:', error);
    process.exit(1);
  }
}

seedDatabase();