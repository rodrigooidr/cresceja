import crypto from 'crypto';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';
import mime from 'mime-types';

let sharp;
try { sharp = (await import('sharp')).default; } catch {}

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

async function fetchBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const len = parseInt(res.headers.get('content-length') || '0', 10);
  if (len && len > MAX_BYTES) throw new Error(`File too large: ${len} > ${MAX_BYTES}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error(`File too large: ${buf.length} > ${MAX_BYTES}`);
  return { buf, headers: res.headers };
}

async function maybeThumb(buf, mimeType) {
  if (!sharp || !/^image\//.test(mimeType)) return { width: null, height: null, thumb: null };
  const img = sharp(buf);
  const meta = await img.metadata();
  const resized = await img.resize({ width: 960, height: 960, fit: 'inside', withoutEnlargement: true }).toBuffer();
  return { width: meta.width || null, height: meta.height || null, thumb: resized };
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

export async function fetchAndStore({ url }) {
  const { buf, headers } = await fetchBuffer(url);
  const mimeType = (headers.get('content-type') || mime.lookup(url) || 'application/octet-stream').split(';')[0];
  const sum = sha256(buf);

  const blobKey = `blobs/${sum}.${mime.extension(mimeType) || 'bin'}`;
  if (PROVIDER === 'local') {
    const file = path.join(LOCAL_DIR, blobKey);
    if (!fs.existsSync(file)) await storeLocal(blobKey, buf, mimeType);
  } else {
    await storeS3(blobKey, buf, mimeType);
  }

  const { width, height, thumb } = await maybeThumb(buf, mimeType);
  let thumbnailKey = null;
  if (thumb) {
    const tKey = `thumbs/${sum}.jpg`;
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
    width, height,
    durationMs: null,
    thumbnailKey,
    posterKey: null
  };
}
