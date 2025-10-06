import { Router } from 'express';

const router = Router();

router.post('/uploads', (req, res) => {
  const now = Date.now();
  return res.status(201).json({
    file_id: `upl-${now}`,
    url: `https://files.local/${now}`,
    content_type: 'application/octet-stream',
    size: 0,
  });
});

export default router;
