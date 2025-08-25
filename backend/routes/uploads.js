import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
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

export default router;
