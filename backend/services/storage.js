import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
// optional S3/MinIO client loaded lazily
let s3 = null;
let S3Client;
let PutObjectCommand;

export const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
await fsp.mkdir(UPLOAD_DIR, { recursive: true });

export async function saveBuffer(buffer, originalName = 'file.bin') {
  const ext = path.extname(originalName) || '';
  const name = `${Date.now()}-${randomUUID()}${ext}`;
  const full = path.join(UPLOAD_DIR, name);
  await fsp.writeFile(full, buffer);
  return { fileName: name, path: full, url: `/uploads/${name}` };
}

export async function saveStream(readable, originalName = 'file.bin') {
  const ext = path.extname(originalName) || '';
  const name = `${Date.now()}-${randomUUID()}${ext}`;
  const full = path.join(UPLOAD_DIR, name);
  await new Promise((resolve, reject) => {
    const ws = fs.createWriteStream(full);
    readable.pipe(ws);
    ws.on('finish', resolve);
    ws.on('error', reject);
  });
  return { fileName: name, path: full, url: `/uploads/${name}` };
}

/**
 * Salva arquivo recebido do multer (memoryStorage)
 *  - se variáveis S3_* estiverem definidas, tenta salvar no S3/MinIO
 *  - caso contrário, persiste no disco local
 */
export async function saveUpload(file) {
  if (!file) throw new Error('file required');
  const ext = path.extname(file.originalname || '') || '';
  const name = `${Date.now()}-${randomUUID()}${ext}`;

  // ====== S3 / MinIO ======
  if (process.env.S3_BUCKET && process.env.S3_ENDPOINT) {
    try {
      if (!s3) {
        const mod = await import('@aws-sdk/client-s3').catch(() => null);
        if (mod) {
          ({ S3Client, PutObjectCommand } = mod);
          s3 = new S3Client({
            endpoint: process.env.S3_ENDPOINT,
            region: process.env.S3_REGION || 'us-east-1',
            credentials: {
              accessKeyId: process.env.S3_KEY,
              secretAccessKey: process.env.S3_SECRET,
            },
            forcePathStyle: true,
          });
        }
      }
      if (s3 && PutObjectCommand) {
        await s3.send(
          new PutObjectCommand({
            Bucket: process.env.S3_BUCKET,
            Key: name,
            Body: file.buffer,
            ContentType: file.mimetype,
          })
        );
        const base = process.env.S3_PUBLIC_URL || `${process.env.S3_ENDPOINT}/${process.env.S3_BUCKET}`;
        return { fileName: name, url: `${base}/${name}` };
      }
    } catch (e) {
      console.error('[storage] S3 upload failed, falling back to disk:', e);
    }
  }

  // ====== Local disk ======
  const full = path.join(UPLOAD_DIR, name);
  await fsp.writeFile(full, file.buffer);
  return { fileName: name, path: full, url: `/uploads/${name}` };
}

export default { UPLOAD_DIR, saveBuffer, saveStream, saveUpload };
