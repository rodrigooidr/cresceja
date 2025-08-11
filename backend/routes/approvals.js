
import { Router } from 'express';
import { query } from '../config/db.js';

export const router = Router();

router.get('/:postId', async (req,res)=>{
  const { postId } = req.params;
  const r = await query('SELECT * FROM post_approvals WHERE post_id=$1 ORDER BY level ASC', [postId]);
  res.json(r.rows);
});

router.post('/:postId/approve', async (req,res)=>{
  const { postId } = req.params;
  const { level = 1, comment = '' } = req.body || {};
  await query(
    `INSERT INTO post_approvals (post_id, level, status, comment, decided_by, decided_at)
     VALUES ($1,$2,'aprovado',$3,$4,NOW())`,
    [postId, Number(level), comment, req.user.id]
  );
  // if last level approved, mark post as 'aprovado'
  const levels = await query('SELECT COUNT(*)::int as c FROM post_approvals WHERE post_id=$1 AND status=\'aprovado\'', [postId]);
  if(levels.rows[0].c >= 2){
    await query('UPDATE social_posts SET status=\'aprovado\' WHERE id=$1', [postId]);
  }
  res.json({ ok:true });
});

router.post('/:postId/reject', async (req,res)=>{
  const { postId } = req.params;
  const { level = 1, comment = '' } = req.body || {};
  await query(
    `INSERT INTO post_approvals (post_id, level, status, comment, decided_by, decided_at)
     VALUES ($1,$2,'reprovado',$3,$4,NOW())`,
    [postId, Number(level), comment, req.user.id]
  );
  await query('UPDATE social_posts SET status=\'reprovado\' WHERE id=$1', [postId]);
  res.json({ ok:true });
});
