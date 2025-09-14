import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { orgScope } from '../middleware/orgScope.js';
import { requireAgent } from '../middleware/rbac.js';

const router = express.Router();
const upload = multer({ dest: path.join(process.cwd(), 'uploads') });

router.use(orgScope);

router.post('/', requireAgent, upload.single('file'), async (req, res) => {
  // TODO: persistir em attachments; por enquanto retorna metadados
  return res.json({
    data: {
      storage_key: req.file.filename,
      mime: req.file.mimetype,
      size_bytes: req.file.size,
    }
  });
});

// POST /api/uploads/sign -> { url, fields, objectUrl }
router.post('/sign', requireAgent, async (req, res) => {
  const { contentType, size } = req.body || {};
  const allowed = ['image/jpeg', 'video/mp4'];
  if (!allowed.includes(contentType)) {
    return res.status(400).json({ error: 'invalid_type' });
  }
  const max = contentType === 'image/jpeg' ? 10 * 1024 * 1024 : 100 * 1024 * 1024;
  if (typeof size !== 'number' || size > max) {
    return res.status(400).json({ error: 'invalid_size' });
  }
  if (!process.env.S3_BUCKET) {
    return res.status(500).json({ error: 's3_not_configured' });
  }
  const key = `${new Date().toISOString().slice(0,10)}/${crypto.randomBytes(16).toString('hex')}`;
  const client = new S3Client({
    region: process.env.S3_REGION || 'us-east-1',
    forcePathStyle: !!process.env.S3_USE_PATH_STYLE || !!process.env.S3_FORCE_PATH_STYLE,
    endpoint: process.env.S3_ENDPOINT || undefined,
    credentials: process.env.S3_ACCESS_KEY_ID
      ? { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY }
      : undefined,
  });
  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    ContentType: contentType,
  });
  const url = await getSignedUrl(client, command, { expiresIn: 60 });
  const base = process.env.S3_PUBLIC_URL || `https://${process.env.S3_BUCKET}.s3.amazonaws.com`;
  return res.json({ url, fields: { key }, objectUrl: `${base}/${key}` });
});

export default router;
