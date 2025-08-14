
import express from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import { UPLOAD_DIR, saveBuffer } from '../services/storage.js';

const router = express.Router();
const upload = multer({ dest: UPLOAD_DIR });

router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file_required' });
  const { originalname, path: tmpPath, mimetype, size } = req.file;
  const buf = await fs.readFile(tmpPath);
  const saved = await saveBuffer(buf, originalname || 'file.bin');
  res.json({ id: saved.fileName, url: saved.url, size, mime: mimetype });
});

export default router;


