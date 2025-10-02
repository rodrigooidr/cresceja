// CRUD simples de assets (content_assets) e posts (public.posts)
import { randomUUID } from 'crypto';
import { pool } from '#db';

function getDb(req) {
  return req.db ?? pool;
}

export async function listAssets(req, res, next) {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 20, 1);
    const offset = (page - 1) * limit;

    const db = getDb(req);
    const totalRes = await db.query(
      'SELECT COUNT(*) FROM content_assets WHERE org_id = $1',
      [req.orgId],
    );
    const total = Number(totalRes.rows[0]?.count || 0);

    const { rows } = await db.query(
      `SELECT id, url, mime, width, height, meta_json AS meta, created_at
         FROM content_assets
        WHERE org_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3`,
      [req.orgId, limit, offset],
    );
    return res.json({ page, limit, total, items: rows });
  } catch (e) {
    next(e);
  }
}

export async function createAsset(req, res, next) {
  try {
    const { url, mime, width, height, meta } = req.body || {};
    if (!url || !mime) return res.status(400).json({ error: 'missing_fields' });

    const db = getDb(req);
    const { rows } = await db.query(
      `INSERT INTO content_assets (id, org_id, url, mime, width, height, meta_json, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)
       RETURNING id, url, mime, width, height, meta_json AS meta, created_at`,
      [
        randomUUID(),
        req.orgId,
        url,
        mime,
        width ?? null,
        height ?? null,
        meta ? JSON.stringify(meta) : null,
        req.user?.id ?? null,
      ],
    );
    return res.status(201).json(rows[0]);
  } catch (e) {
    next(e);
  }
}

// POSTS (usa tabela public.posts se existir; senão, cria fallback em memória simples)
async function ensurePostsTable() {
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='posts'
      ) THEN
        CREATE TABLE public.posts (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          org_id uuid NOT NULL,
          title text NOT NULL,
          body text,
          status text NOT NULL DEFAULT 'draft',
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS ix_posts_org ON public.posts(org_id, created_at DESC);
      END IF;
    END $$;
  `);
}

export async function listPosts(req, res, next) {
  try {
    await ensurePostsTable();
    const db = getDb(req);
    const { rows } = await db.query(
      `SELECT id, title, body, status, created_at, updated_at
         FROM public.posts
        WHERE org_id = $1
        ORDER BY created_at DESC
        LIMIT 200`,
      [req.orgId],
    );
    res.json({ items: rows });
  } catch (e) {
    next(e);
  }
}

export async function getPost(req, res, next) {
  try {
    await ensurePostsTable();
    const db = getDb(req);
    const { id } = req.params;
    const { rows } = await db.query(
      `SELECT id, title, body, status, created_at, updated_at
         FROM public.posts
        WHERE org_id = $1 AND id = $2`,
      [req.orgId, id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
}

export async function createPost(req, res, next) {
  try {
    await ensurePostsTable();
    const db = getDb(req);
    const { title, body, status } = req.body || {};
    if (!title) return res.status(400).json({ error: 'missing_title' });
    const { rows } = await db.query(
      `INSERT INTO public.posts (id, org_id, title, body, status)
       VALUES (gen_random_uuid(), $1, $2, $3, COALESCE($4,'draft'))
       RETURNING id, title, body, status, created_at, updated_at`,
      [req.orgId, title, body ?? null, status ?? 'draft'],
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    next(e);
  }
}

export async function updatePost(req, res, next) {
  try {
    await ensurePostsTable();
    const db = getDb(req);
    const { id } = req.params;
    const { title, body, status } = req.body || {};
    const { rows } = await db.query(
      `UPDATE public.posts
          SET title = COALESCE($3, title),
              body = COALESCE($4, body),
              status = COALESCE($5, status),
              updated_at = now()
        WHERE org_id = $1 AND id = $2
        RETURNING id, title, body, status, created_at, updated_at`,
      [req.orgId, id, title ?? null, body ?? null, status ?? null],
    );
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
}
