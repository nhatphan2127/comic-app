import { copyFile, mkdir, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { storageRoot } from '../config/storage.js';

export const STORAGE_DRIVER = (process.env.STORAGE_DRIVER || 'local').toLowerCase();
const bucket = process.env.STORAGE_BUCKET;
const publicUrl = process.env.STORAGE_PUBLIC_URL?.replace(/\/+$/, '');
const accessKey = process.env.STORAGE_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID;
const secretKey = process.env.STORAGE_SECRET_KEY || process.env.AWS_SECRET_ACCESS_KEY;

if (!['local', 's3'].includes(STORAGE_DRIVER)) {
  throw new Error('STORAGE_DRIVER must be either "local" or "s3"');
}

if (STORAGE_DRIVER === 's3' && !bucket) {
  throw new Error('STORAGE_BUCKET is required when STORAGE_DRIVER=s3');
}
if (STORAGE_DRIVER === 's3' && !publicUrl) {
  throw new Error('STORAGE_PUBLIC_URL is required when STORAGE_DRIVER=s3');
}
if (STORAGE_DRIVER === 's3' && !['http:', 'https:'].includes(new URL(publicUrl).protocol)) {
  throw new Error('STORAGE_PUBLIC_URL must use HTTP or HTTPS');
}
if (Boolean(accessKey) !== Boolean(secretKey)) {
  throw new Error('S3 access key and secret key must be configured together');
}

const s3 = STORAGE_DRIVER === 's3'
  ? new S3Client({
      ...(process.env.STORAGE_ENDPOINT && { endpoint: process.env.STORAGE_ENDPOINT }),
      region: process.env.STORAGE_REGION || 'us-east-1',
      forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE !== 'false',
      ...(accessKey && secretKey
        ? {
            credentials: {
              accessKeyId: accessKey,
              secretAccessKey: secretKey,
            },
          }
        : {}),
    })
  : null;

function normalizeObjectKey(key) {
  if (typeof key !== 'string') throw new Error('Invalid storage object key');
  const normalized = key.replaceAll('\\', '/').replace(/^\/+/, '');
  if (!normalized || normalized.split('/').some((part) => !part || part === '.' || part === '..')) {
    throw new Error('Invalid storage object key');
  }
  return normalized;
}

export async function uploadStorageFile(key, filePath, contentType) {
  const objectKey = normalizeObjectKey(key);
  if (STORAGE_DRIVER === 'local') return objectKey;

  const body = await readFile(filePath);
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    Body: body,
    ContentLength: body.length,
    ContentType: contentType,
  }));
  return objectKey;
}

export async function uploadStagedStorageFile(key, filePath, contentType) {
  const objectKey = normalizeObjectKey(key);
  if (STORAGE_DRIVER === 's3') return uploadStorageFile(objectKey, filePath, contentType);

  const root = path.resolve(storageRoot);
  const destination = path.resolve(root, ...objectKey.split('/'));
  if (!destination.startsWith(`${root}${path.sep}`)) throw new Error('Invalid storage object key');
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(filePath, destination);
  return objectKey;
}

export async function removeStorageObject(key) {
  const objectKey = normalizeObjectKey(key);
  if (STORAGE_DRIVER === 's3') {
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }));
    return;
  }

  const root = path.resolve(storageRoot);
  const fullPath = path.resolve(root, ...objectKey.split('/'));
  if (fullPath.startsWith(`${root}${path.sep}`)) {
    await unlink(fullPath).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
}

export function getStoragePublicUrl(key) {
  if (STORAGE_DRIVER !== 's3') throw new Error('Public object URLs are only available with STORAGE_DRIVER=s3');
  const objectKey = normalizeObjectKey(key);
  return `${publicUrl}/${objectKey.split('/').map(encodeURIComponent).join('/')}`;
}
