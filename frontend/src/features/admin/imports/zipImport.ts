import type { AdminImportManifest } from '../../../services/api';

const MB = 1024 * 1024;
const MAX_ZIP_BYTES = 2048 * MB;
const MAX_TOTAL_BYTES = 4096 * MB;
const MAX_ENTRIES = 20000;
// Keep in sync with backend/src/services/adminImportValidation.js (long-strip pages are often >10 MB).
const MAX_IMAGE_BYTES = 32 * MB;
const MAX_COMIC_JSON_BYTES = 64 * 1024;
const MAX_PAGES = 300;
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
export const IMPORT_LIMITS = {
  zipBytes: MAX_ZIP_BYTES,
  totalBytes: MAX_TOTAL_BYTES,
  imageBytes: MAX_IMAGE_BYTES,
  pagesPerChapter: MAX_PAGES,
};
const natural = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }).compare;

export interface ZipUploadFile {
  id: string;
  /** Key of the comic this image belongs to (manifest.comics[i].key). */
  comicKey: string;
  archivePath: string;
  name: string;
  size: number;
}

export interface PreparedZip {
  manifest: AdminImportManifest;
  files: ZipUploadFile[];
  stats: { comics: number; chapters: number; files: number; bytes: number };
}

type Entry = { path: string; size: number; isDirectory: boolean; data?: Uint8Array };

function archivePath(value: string) {
  const normalized = value.replace(/\\/g, '/');
  if (!normalized || normalized.startsWith('/') || /^[a-z]:/i.test(normalized)) {
    throw new Error(`ZIP entry has an absolute or empty path: ${value}`);
  }
  const parts = normalized.split('/').filter(Boolean);
  if (!parts.length || parts.some((part) => part === '.' || part === '..')) {
    throw new Error(`ZIP entry has an unsafe path: ${value}`);
  }
  return `${parts.join('/')}${normalized.endsWith('/') ? '/' : ''}`;
}

const folderOf = (value: string) => {
  const path = value.endsWith('/') ? value.slice(0, -1) : value;
  const slash = path.lastIndexOf('/');
  return slash < 0 ? '.' : path.slice(0, slash);
};

const basename = (value: string) => {
  const path = value.endsWith('/') ? value.slice(0, -1) : value;
  return path.slice(path.lastIndexOf('/') + 1);
};

const extension = (name: string) => {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot).toLowerCase();
};

const isImage = (name: string) => IMAGE_EXTENSIONS.has(extension(name));
const isJunk = (value: string) =>
  value.split('/').some((part) => part.startsWith('.') || part === '__MACOSX') ||
  /(^|\/)(thumbs\.db|desktop\.ini)$/i.test(value);

function sizeLimit(name: string) {
  const lower = basename(name).toLowerCase();
  if (lower === 'comic.json') return MAX_COMIC_JSON_BYTES;
  if (isImage(name)) return MAX_IMAGE_BYTES;
  return MAX_TOTAL_BYTES;
}

async function readEntries(
  file: File,
  capture: (path: string) => boolean,
  onComplete: (entry: Entry, data?: Uint8Array) => void | Promise<void>,
  onProgress: (read: number) => void,
  signal?: AbortSignal,
) {
  const { Unzip, UnzipInflate, UnzipPassThrough } = await import('fflate');
  const entries: Entry[] = [];
  const promises: Promise<void>[] = [];
  const seenPaths = new Set<string>();
  let totalUncompressed = 0;
  let count = 0;
  let serial = Promise.resolve();
  let failure: Error | null = null;
  const unzip = new Unzip((stream) => {
    const entryPath = archivePath(stream.name);
    if (seenPaths.has(entryPath)) throw new Error(`ZIP contains a duplicate path: ${entryPath}`);
    seenPaths.add(entryPath);
    count += 1;
    if (count > MAX_ENTRIES) throw new Error(`ZIP contains more than ${MAX_ENTRIES} entries`);
    const isDirectory = entryPath.endsWith('/');
    const shouldCapture = !isDirectory && capture(entryPath);
    const chunks: Uint8Array[] = [];
    let size = 0;
    let resolveEntry = () => {};
    let rejectEntry = (_error: Error) => {};
    const entryPromise = new Promise<void>((resolve, reject) => {
      resolveEntry = resolve;
      rejectEntry = reject;
    });
    void entryPromise.catch(() => undefined);
    promises.push(entryPromise);
    stream.ondata = (error, data, final) => {
      if (error) {
        failure = error;
        rejectEntry(error);
        return;
      }
      if (failure) return;
      size += data.length;
      totalUncompressed += data.length;
      if (size > sizeLimit(entryPath)) {
        const limit = sizeLimit(entryPath);
        failure = new Error(
          `"${entryPath}" is larger than ${limit >= MB ? `${limit / MB} MB` : `${limit / 1024} KB`}, the import limit for this file type`,
        );
        rejectEntry(failure);
        stream.terminate();
        return;
      }
      if (totalUncompressed > MAX_TOTAL_BYTES) {
        failure = new Error(`ZIP expands beyond ${MAX_TOTAL_BYTES / MB} MB`);
        rejectEntry(failure);
        stream.terminate();
        return;
      }
      if (shouldCapture && data.length) chunks.push(data);
      if (final) {
        const entry = { path: entryPath, size, isDirectory };
        entries.push(entry);
        const bytes = shouldCapture ? concatenate(chunks, size) : undefined;
        serial = serial.then(() => onComplete(entry, bytes)).then(resolveEntry, (reason: unknown) => {
          const error = reason instanceof Error ? reason : new Error(String(reason));
          failure = error;
          rejectEntry(error);
        });
      }
    };
    stream.start();
  });
  unzip.register(UnzipInflate);
  unzip.register(UnzipPassThrough);

  const reader = file.stream().getReader();
  let read = 0;
  try {
    while (true) {
      if (signal?.aborted) throw new DOMException('Import cancelled', 'AbortError');
      const { done, value } = await reader.read();
      if (done) break;
      read += value.length;
      unzip.push(value, false);
      onProgress(read);
      await serial;
      if (failure) throw failure;
    }
    unzip.push(new Uint8Array(), true);
    await serial;
    await Promise.all(promises);
    if (failure) throw failure;
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
  return entries;
}

function concatenate(chunks: Uint8Array[], size: number) {
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function chapterOf(name: string) {
  const match = /\d+(?:\.\d+)?/.exec(name);
  if (!match) return null;
  const title = name.split(' - ').slice(1).join(' - ').trim();
  return { number: Number(match[0]), ...(title ? { title } : {}) };
}

function jsonEntry(entry: Entry) {
  if (!entry.data) throw new Error(`Could not read ${entry.path}`);
  try {
    return JSON.parse(new TextDecoder().decode(entry.data).replace(/^\uFEFF/, '')) as Record<string, unknown>;
  } catch (error) {
    throw new Error(`${entry.path} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function inspectZip(file: File, onProgress: (read: number) => void, signal?: AbortSignal): Promise<PreparedZip> {
  if (!file.name.toLowerCase().endsWith('.zip')) throw new Error('Choose a .zip file');
  if (file.size > MAX_ZIP_BYTES) throw new Error(`ZIP is larger than ${MAX_ZIP_BYTES / MB} MB`);

  const entries = await readEntries(
    file,
    (path) => basename(path).toLowerCase() === 'comic.json',
    (entry, data) => {
      if (basename(entry.path).toLowerCase() === 'comic.json') entry.data = data;
    },
    onProgress,
    signal,
  );
  const files = entries.filter((entry) => !entry.isDirectory && !isJunk(entry.path));
  const comicJsonFiles = files.filter((entry) => basename(entry.path).toLowerCase() === 'comic.json');
  const byFolder = new Map<string, Entry[]>();
  const folders = new Set<string>();
  for (const entry of files) {
    const folder = folderOf(entry.path);
    const list = byFolder.get(folder) ?? [];
    list.push(entry);
    byFolder.set(folder, list);
    let parent = folder;
    while (parent !== '.') {
      folders.add(parent);
      parent = folderOf(parent);
    }
  }
  for (const entry of entries.filter((candidate) => candidate.isDirectory)) {
    folders.add(entry.path.slice(0, -1));
  }
  const jsonByFolder = new Map<string, Entry[]>();
  for (const entry of comicJsonFiles) {
    const folder = folderOf(entry.path);
    const list = jsonByFolder.get(folder) ?? [];
    list.push(entry);
    jsonByFolder.set(folder, list);
  }
  const comicFolders = [...jsonByFolder.keys()].sort(natural);
  if (!comicFolders.length) throw new Error('No comic.json found in the ZIP');

  const uploads: ZipUploadFile[] = [];
  const comics = comicFolders.map((folder, comicIndex) => {
    const comicJson = jsonByFolder.get(folder) ?? [];
    if (comicJson.length !== 1) throw new Error(`Expected exactly one comic.json in ${folder}`);
    const info = jsonEntry(comicJson[0]);
    const { id: ignoredId, ...data } = info;
    void ignoredId;
    const directFiles = byFolder.get(folder) ?? [];
    const covers = directFiles.filter((entry) => {
      const name = basename(entry.path);
      return isImage(name) && name.slice(0, name.lastIndexOf('.')).toLowerCase() === 'cover';
    });
    if (covers.length !== 1) throw new Error(`Expected exactly one cover image in ${folder}`);

    const comicKey = `c${comicIndex}`;
    const cover = covers[0];
    uploads.push({ id: `${comicKey}-cover`, comicKey, archivePath: cover.path, name: basename(cover.path), size: cover.size });
    const childFolders = [...folders]
      .filter((child) => child !== folder && folderOf(child) === folder && !(jsonByFolder.get(child)?.length))
      .map((child) => ({ folder: child, parsed: chapterOf(basename(child)) }))
      .filter((child): child is { folder: string; parsed: NonNullable<ReturnType<typeof chapterOf>> } => Boolean(child.parsed))
      .sort((a, b) => a.parsed.number - b.parsed.number || natural(a.folder, b.folder));

    const chapters = childFolders.map(({ folder: chapterFolder, parsed }, chapterIndex) => {
      const chapterFiles = (byFolder.get(chapterFolder) ?? [])
        .filter((entry) => isImage(basename(entry.path)))
        .sort((a, b) => natural(basename(a.path), basename(b.path)));
      if (!chapterFiles.length) throw new Error(`Chapter folder ${chapterFolder} has no images`);
      if (chapterFiles.length > MAX_PAGES) throw new Error(`Chapter folder ${chapterFolder} has more than ${MAX_PAGES} pages`);
      const chapterKey = `${comicKey}-h${chapterIndex}`;
      const pages = chapterFiles.map((entry, pageIndex) => {
        uploads.push({
          id: `${chapterKey}-p${pageIndex}`,
          comicKey,
          archivePath: entry.path,
          name: basename(entry.path),
          size: entry.size,
        });
        return { name: basename(entry.path), size: entry.size };
      });
      return { folder: basename(chapterFolder), number: parsed.number, ...(parsed.title && { title: parsed.title }), pages };
    });

    return {
      key: comicKey,
      data,
      comicJsonBytes: comicJson[0].size,
      cover: { name: basename(cover.path), size: cover.size },
      chapters,
    };
  });

  return {
    manifest: { comics },
    files: uploads,
    stats: {
      comics: comics.length,
      chapters: comics.reduce((sum, comic) => sum + comic.chapters.length, 0),
      files: uploads.length,
      bytes: uploads.reduce((sum, upload) => sum + upload.size, 0),
    },
  };
}

function mimeType(name: string) {
  switch (extension(name)) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    default:
      throw new Error(`Unsupported image format: ${name}`);
  }
}

export async function uploadZipFiles(
  file: File,
  prepared: PreparedZip,
  upload: (target: ZipUploadFile, file: File) => Promise<void>,
  onProgress: (uploaded: number, total: number) => void,
  signal?: AbortSignal,
) {
  const byPath = new Map(prepared.files.map((entry) => [entry.archivePath, entry]));
  let uploaded = 0;
  await readEntries(
    file,
    (path) => byPath.has(path),
    async (entry, bytes) => {
      const target = byPath.get(entry.path);
      if (!target) return;
      if (!bytes || bytes.length !== target.size) throw new Error(`Could not extract ${entry.path} completely`);
      const buffer = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(buffer).set(bytes);
      const blob = new Blob([buffer], { type: mimeType(target.name) });
      await upload(target, new File([blob], target.name, { type: blob.type }));
      uploaded += 1;
      onProgress(uploaded, prepared.files.length);
    },
    () => undefined,
    signal,
  );
  if (uploaded !== prepared.files.length) throw new Error('ZIP file list changed while importing; no records were committed');
}
