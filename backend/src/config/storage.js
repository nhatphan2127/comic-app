import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const storageRoot = process.env.STORAGE_ROOT || path.join(__dirname, '..', '..', 'storage');
export const comicsFolder = path.join(storageRoot, 'comics');
export const chapterImagesFolder = path.join(storageRoot, 'chapter-images');
export const avatarsFolder = path.join(storageRoot, 'avatars');
export const backgroundsFolder = path.join(storageRoot, 'backgrounds');

for (const folder of [comicsFolder, chapterImagesFolder, avatarsFolder, backgroundsFolder]) {
  fs.mkdirSync(folder, { recursive: true });
}
