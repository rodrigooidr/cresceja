import axios from 'axios';
import { randomBytes } from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const MEDIA_ROOT = path.join(process.cwd(), 'uploads', 'media');
const useS3 = Boolean(process.env.S3_BUCKET);

const s3 = useS3
  ? new S3Client({
      region: process.env.S3_REGION || 'us-east-1',
      forcePathStyle: Boolean(process.env.S3_USE_PATH_STYLE || process.env.S3_FORCE_PATH_STYLE),
      endpoint: process.env.S3_ENDPOINT || undefined,
      credentials: process.env.S3_ACCESS_KEY_ID
        ? {
            accessKeyId: process.env.S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
          }
        : undefined,
    })
  : null;

function safeOrg(orgId) {
  return String(orgId || 'org')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '');
}

function extFromMime(mime) {
  if (!mime) return '';
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/gif') return 'gif';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'video/mp4') return 'mp4';
  if (mime === 'video/mpeg') return 'mpeg';
  if (mime === 'audio/mpeg') return 'mp3';
  if (mime === 'audio/ogg') return 'ogg';
  if (mime === 'application/pdf') return 'pdf';
  const parts = mime.split('/');
  if (parts.length === 2 && parts[1]) return parts[1].replace(/[^a-z0-9]/gi, '');
  return '';
}

function makeStorageKey(orgId, mime) {
  const org = safeOrg(orgId);
  const day = new Date().toISOString().slice(0, 10);
  const ext = extFromMime(mime);
  const rand = randomBytes(12).toString('hex');
  return `${org}/${day}/${rand}${ext ? `.${ext}` : ''}`;
}

function resolveLocalPath(key) {
  const base = path.resolve(MEDIA_ROOT);
  const target = path.resolve(base, key);
  if (!target.startsWith(base)) {
    throw new Error('invalid_storage_key');
  }
  return target;
}

export async function fetchAndStore(url, token, orgId) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await axios.get(url, { responseType: 'arraybuffer', headers });
  const buffer = Buffer.from(response.data);
  const mime = response.headers['content-type'] || null;
  const size = Number(response.headers['content-length']) || buffer.length;
  const key = makeStorageKey(orgId, mime);

  if (useS3) {
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: mime || undefined,
      })
    );
  } else {
    const dest = resolveLocalPath(key);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, buffer);
  }

  return { storage_key: key, mime, size };
}

export function isS3Enabled() {
  return useS3;
}

export async function getSignedMediaUrl(storageKey, { expiresIn = 300 } = {}) {
  if (!useS3 || !storageKey) return null;
  const command = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: storageKey,
  });
  return getSignedUrl(s3, command, { expiresIn });
}

export async function getLocalMediaStream(storageKey) {
  if (useS3) return null;
  const file = resolveLocalPath(storageKey);
  const stats = await fs.stat(file);
  return {
    stream: createReadStream(file),
    size: stats.size,
  };
}

export { MEDIA_ROOT as MEDIA_STORAGE_DIR };

export default {
  fetchAndStore,
  getSignedMediaUrl,
  getLocalMediaStream,
  isS3Enabled,
  MEDIA_STORAGE_DIR: MEDIA_ROOT,
};
