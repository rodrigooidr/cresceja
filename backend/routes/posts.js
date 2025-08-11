
import { Router } from 'express';
import { query } from '../config/db.js';

export const router = Router();

router.get('/', async (req,res)=>{
  const { status } = req.query;
  const params = [];
  let sql = 'SELECT * FROM social_posts';
  if(status){
    params.push(status);
    sql += ` WHERE status = $${params.length}`;
  }
  sql += ' ORDER BY created_at DESC';
  const r = await query(sql, params);
  res.json(r.rows);
});

router.post('/', async (req,res)=>{
  const { title, content, channel, media_url, scheduled_at } = req.body || {};
  const r = await query(
    `INSERT INTO social_posts (title, content, channel, media_url, scheduled_at, status, created_by) 
     VALUES ($1,$2,$3,$4,$5,'pendente',$6) RETURNING *`,
    [title, content, channel, media_url || null, scheduled_at || null, req.user.id]
  );
  res.status(201).json(r.rows[0]);
});

router.put('/:id', async (req,res)=>{
  const { id } = req.params;
  const { title, content, channel, media_url, scheduled_at, status } = req.body || {};
  const r = await query(
    `UPDATE social_posts SET title=$1, content=$2, channel=$3, media_url=$4, scheduled_at=$5, status=$6 WHERE id=$7 RETURNING *`,
    [title, content, channel, media_url, scheduled_at, status, id]
  );
  res.json(r.rows[0]);
});
