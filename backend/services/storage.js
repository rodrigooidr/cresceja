import crypto from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

const useS3 = !!process.env.S3_BUCKET;
const s3 = useS3
  ? new S3Client({
      region: process.env.S3_REGION || 'us-east-1',
      // `S3_USE_PATH_STYLE` is the preferred flag but keep backwards compat
      // with the previous `S3_FORCE_PATH_STYLE` env.
      forcePathStyle: !!process.env.S3_USE_PATH_STYLE ||
        !!process.env.S3_FORCE_PATH_STYLE,
      endpoint: process.env.S3_ENDPOINT || undefined,
      credentials: process.env.S3_ACCESS_KEY_ID
        ? {
            accessKeyId: process.env.S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
          }
        : undefined,
    })
  : null;

export async function saveUpload({ buffer, mime, filename }) {
  const day = new Date().toISOString().slice(0, 10);
  const key = `${day}/${crypto.randomBytes(16).toString('hex')}-${filename}`;
  if (useS3) {
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: mime,
      })
    );
    const base =
      process.env.S3_PUBLIC_URL || `https://${process.env.S3_BUCKET}.s3.amazonaws.com`;
    return { key, url: `${base}/${key}`, mime, filename };
  }
  const dir = path.join(UPLOAD_DIR, day);
  await fs.mkdir(dir, { recursive: true });
  const dest = path.join(dir, key.split('/').pop());
  await fs.writeFile(dest, buffer);
  return { key, url: `/uploads/${key.split('/').pop()}`, mime, filename };
}

export default { saveUpload, UPLOAD_DIR };
