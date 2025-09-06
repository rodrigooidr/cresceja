
import express from 'express';
import multer from 'multer';
import { saveUpload } from '../services/storage.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file_required' });
  const { buffer, originalname, mimetype, size } = req.file;
  const saved = await saveUpload({ buffer, mime: mimetype, filename: originalname || 'file.bin' });
  res.json({ id: saved.key, url: saved.url, size, mime: mimetype });
});

export default router;


