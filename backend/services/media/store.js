import crypto from 'crypto';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';
import mime from 'mime-types';

let sharp;
try { sharp = (await import('sharp')).default; } catch {}

let axios;
try {
  const mod = await import('axios');
  axios = mod.default ?? mod;
} catch {}

const PROVIDER = process.env.MEDIA_STORAGE_PROVIDER || 'local';
const LOCAL_DIR = process.env.MEDIA_LOCAL_DIR || './storage';
const MAX_MB = parseInt(process.env.MAX_MEDIA_SIZE_MB || '20', 10);
const MAX_BYTES = MAX_MB * 1024 * 1024;

let s3, getSignedUrl, S3Client, PutObjectCommand, GetObjectCommand;
if (PROVIDER === 's3') {
  const mod = await import('@aws-sdk/client-s3');
  S3Client = mod.S3Client; PutObjectCommand = mod.PutObjectCommand; GetObjectCommand = mod.GetObjectCommand;
  ({ getSignedUrl } = await import('@aws-sdk/s3-request-presigner'));
  s3 = new S3Client({ region: process.env.AWS_REGION });
}

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const ensureDir = async (p) => fsp.mkdir(p, { recursive: true });

function wrapHeaders(raw) {
  if (!raw) {
    return { get: () => null };
  }
  if (typeof raw.get === 'function') return raw;
  return {
    get(name) {
      const key = name.toLowerCase();
      const val = raw[key] ?? raw[name];
      if (Array.isArray(val)) return val[0];
      return val ?? null;
    },
  };
}

async function fetchBuffer(url, token = null, extraHeaders = {}) {
  if (!url) throw new Error('url_required');
  const headers = { ...(extraHeaders || {}) };
  if (token && !headers.Authorization) {
    headers.Authorization = token.startsWith('Bearer ')
      ? token
      : `Bearer ${token}`;
  }
  if (axios) {
    const res = await axios.get(url, { responseType: 'arraybuffer', headers });
    const buf = Buffer.isBuffer(res.data) ? Buffer.from(res.data) : Buffer.from(res.data || []);
    if (buf.length > MAX_BYTES) throw new Error(`File too large: ${buf.length} > ${MAX_BYTES}`);
    return { buf, headers: wrapHeaders(res.headers) };
  }
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const wrapped = wrapHeaders(res.headers);
  const len = parseInt(wrapped.get('content-length') || '0', 10);
  if (len && len > MAX_BYTES) throw new Error(`File too large: ${len} > ${MAX_BYTES}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error(`File too large: ${buf.length} > ${MAX_BYTES}`);
  return { buf, headers: wrapped };
}

async function maybeThumb(buf, mimeType) {
  if (!sharp || !/^image\//.test(mimeType)) return { width: null, height: null, thumb: null };
  try {
    const img = sharp(buf);
    const meta = await img.metadata();
    const resized = await img
      .resize({ width: 960, height: 960, fit: 'inside', withoutEnlargement: true })
      .toBuffer();
    return { width: meta.width || null, height: meta.height || null, thumb: resized };
  } catch {
    return { width: null, height: null, thumb: null };
  }
}

async function storeLocal(key, buf, mimeType) {
  const base = path.join(LOCAL_DIR, key.split('/')[0]);
  await ensureDir(base);
  const file = path.join(LOCAL_DIR, key);
  await ensureDir(path.dirname(file));
  await fsp.writeFile(file, buf);
  return { storageProvider: 'local', pathOrKey: key, mime: mimeType, sizeBytes: buf.length };
}

async function storeS3(key, buf, mimeType) {
  const Bucket = process.env.AWS_S3_BUCKET;
  await s3.send(new PutObjectCommand({ Bucket, Key: key, Body: buf, ContentType: mimeType }));
  return { storageProvider: 's3', pathOrKey: key, mime: mimeType, sizeBytes: buf.length };
}

export async function getPresignedOrPublic({ pathOrKey, expiresSec = 300 }) {
  if (PROVIDER !== 's3') return null;
  const Bucket = process.env.AWS_S3_BUCKET;
  const publicRead = /^true$/i.test(process.env.S3_PUBLIC_READ || 'false');
  if (publicRead) return `https://${Bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${encodeURIComponent(pathOrKey)}`;
  const cmd = new GetObjectCommand({ Bucket, Key: pathOrKey });
  return await getSignedUrl(s3, cmd, { expiresIn: expiresSec });
}

export const MEDIA_STORAGE_DIR = LOCAL_DIR;

export async function fetchAndStore(arg, token = null, orgId = null) {
  let url = null;
  let extraHeaders = {};
  if (typeof arg === 'string') {
    url = arg;
  } else if (arg && typeof arg === 'object') {
    url = arg.url || null;
    if (arg.token) token = arg.token;
    if (arg.orgId) orgId = arg.orgId;
    extraHeaders = arg.headers || {};
  }

  const { buf, headers } = await fetchBuffer(url, token, extraHeaders);
  const mimeType = (headers.get('content-type') || mime.lookup(url) || 'application/octet-stream').split(';')[0];
  const sum = sha256(buf);
  const ext = mime.extension(mimeType) || 'bin';
  const prefix = orgId ? `${orgId}/` : '';

  const blobKey = `${prefix}blobs/${sum}.${ext}`;
  if (PROVIDER === 'local') {
    const file = path.join(LOCAL_DIR, blobKey);
    if (!fs.existsSync(file)) await storeLocal(blobKey, buf, mimeType);
  } else {
    await storeS3(blobKey, buf, mimeType);
  }

  const { width, height, thumb } = await maybeThumb(buf, mimeType);
  let thumbnailKey = null;
  if (thumb) {
    const tKey = `${prefix}thumbs/${sum}.jpg`;
    if (PROVIDER === 'local') await storeLocal(tKey, thumb, 'image/jpeg');
    else await storeS3(tKey, thumb, 'image/jpeg');
    thumbnailKey = tKey;
  }

  return {
    checksum: sum,
    storageProvider: PROVIDER,
    pathOrKey: blobKey,
    mime: mimeType,
    sizeBytes: buf.length,
    width,
    height,
    durationMs: null,
    thumbnailKey,
    posterKey: null,
    storage_key: blobKey,
    size: buf.length,
  };
}
