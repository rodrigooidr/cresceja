import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { withOrgScope } from '../middleware/withOrg.js';
import { authRequired } from '../middleware/auth.js';
import { pool } from '#db';

const router = express.Router();
const uploadDir = path.join(process.cwd(), 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({ dest: uploadDir });

router.use(authRequired, withOrgScope);

// Upload local simples, retorna URL relativa /uploads/<file>
router.post('/', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'missing_file' });
    const { mimetype, filename, originalname, size } = req.file;
    const publicUrl = `/uploads/${filename}`;
    const db = req.db ?? pool;

    // persiste em content_assets
    await db.query(
      `INSERT INTO content_assets (id, org_id, url, mime, meta_json)
       VALUES ($1,$2,$3,$4,$5::jsonb)`,
      [randomUUID(), req.orgId, publicUrl, mimetype, JSON.stringify({ originalname, size })],
    );

    res.status(201).json({ url: publicUrl, mime: mimetype, name: originalname, size });
  } catch (e) {
    next(e);
  }
});

export default router;
