// download-emojis.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EMOJI_TS_PATH = path.join(__dirname, 'src/assets/emojis/emojis.ts');
const OUTPUT_DIR = path.join(__dirname, 'public/emojis');

// Tạo thư mục public/emojis nếu chưa tồn tại
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Chuyển đổi tên category thành tên thư mục trùng khớp với cấu trúc thực tế (thay thế " & " bằng "__")
function getFolderName(category) {
  return category.replace(/\s*&\s*/g, '__');
}

console.log('Đang phân tích cú pháp emojis.ts...');
let emojis = [];

try {
  const fileContent = fs.readFileSync(EMOJI_TS_PATH, 'utf8');
  
  // Regex trích xuất đồng thời code và category từ cấu trúc object trong file TS
  const emojiRegex = /\{\s*code:\s*['"]([^'"]+)['"]\s*,\s*name:\s*['"]([\s\S]*?)['"]\s*,\s*category:\s*['"]([^'"]+)['"]\s*\}/g;
  
  let match;
  while ((match = emojiRegex.exec(fileContent)) !== null) {
    emojis.push({
      code: match[1],
      name: match[2],
      category: match[3]
    });
  }
  
  // Loại bỏ trùng lặp dựa trên mã code
  const uniqueCodes = new Set();
  emojis = emojis.filter(item => {
    if (uniqueCodes.has(item.code)) {
      return false;
    }
    uniqueCodes.add(item.code);
    return true;
  });

} catch (error) {
  console.error('Lỗi khi đọc file emojis.ts:', error.message);
  process.exit(1);
}

console.log(`Tìm thấy tất cả ${emojis.length} biểu tượng cảm xúc độc nhất cần tải.`);

// Hàm tải file từ xa
const downloadFile = (code, folderName) => {
  // Sử dụng độ phân giải cao fb48 (48px) để có ảnh chất lượng tốt hơn
  const url = `https://emoji.fbicons.net/fb48/${code}.webp`;
  const targetFolder = path.join(OUTPUT_DIR, folderName);
  
  // Tạo thư mục con nếu chưa tồn tại
  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder, { recursive: true });
  }
  
  const destPath = path.join(targetFolder, `${code}.webp`);

  return new Promise((resolve, reject) => {
    if (fs.existsSync(destPath)) {
      return resolve({ code, status: 'exists' });
    }

    const file = fs.createWriteStream(destPath);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        file.close();
        if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
        return reject(new Error(`Lỗi HTTP ${response.statusCode} đối với mã: ${code}`));
      }

      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve({ code, status: 'downloaded' });
      });
    }).on('error', (err) => {
      file.close();
      if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
      reject(err);
    });
  });
};

// Hàm tải đồng thời theo nhóm (Batching) để tránh nghẽn mạng hoặc bị máy chủ chặn
const downloadInBatches = async (items, batchSize = 10) => {
  let successCount = 0;
  let existCount = 0;
  let failCount = 0;

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    console.log(`Đang tải lượt từ ${i + 1} đến ${Math.min(i + batchSize, items.length)}...`);

    const promises = batch.map(item => {
      const folderName = getFolderName(item.category);
      return downloadFile(item.code, folderName)
        .then(res => {
          if (res.status === 'exists') existCount++;
          else successCount++;
        })
        .catch(err => {
          console.warn(`[Cảnh báo] Thất bại khi tải ${item.code}:`, err.message);
          failCount++;
        });
    });

    await Promise.all(promises);
    // Thời gian nghỉ ngắn giữa các đợt tải
    await new Promise(resolve => setTimeout(resolve, 150));
  }

  console.log('\n--- Hoàn tất tiến trình ---');
  console.log(`- Đã tải mới thành công: ${successCount} tệp`);
  console.log(`- Đã có sẵn cục bộ (bỏ qua): ${existCount} tệp`);
  console.log(`- Tải thất bại: ${failCount} tệp`);
};

downloadInBatches(emojis, 12);