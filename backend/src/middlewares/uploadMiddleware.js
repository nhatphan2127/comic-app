import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';

const storageRoot = path.join(process.cwd(), 'storage');
const comicsFolder = path.join(storageRoot, 'comics');
const chapterImagesFolder = path.join(storageRoot, 'chapter-images');

[comicsFolder, chapterImagesFolder].forEach((folder) => {
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
  }
});

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const folder = file.fieldname === 'coverImage' ? comicsFolder : chapterImagesFolder;
    cb(null, folder);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname) || '.png';
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
    cb(null, fileName);
  },
});

const upload = multer({ storage });
export default upload;
