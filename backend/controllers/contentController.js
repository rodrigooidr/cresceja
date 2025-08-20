import { randomUUID } from 'crypto';

export async function listAssets(req, res, next) {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 20, 1);
    const offset = (page - 1) * limit;

    const totalRes = await req.db.query(
      'SELECT COUNT(*) FROM assets WHERE org_id = $1',
      [req.orgId]
    );
    const total = Number(totalRes.rows[0]?.count || 0);

    const { rows } = await req.db.query(
      `SELECT id, filename, url, metadata, created_at
         FROM assets
        WHERE org_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3`,
      [req.orgId, limit, offset]
    );

    res.json({ data: rows, meta: { page, limit, total } });
  } catch (err) {
    next(err);
  }
}

export async function createAsset(req, res, next) {
  try {
    const { filename, data } = req.body || {};
    if (!filename || !data) {
      return res.status(400).json({ error: 'invalid_input' });
    }

    let base64 = String(data);
    const comma = base64.indexOf(',');
    if (comma >= 0) base64 = base64.slice(comma + 1);
    const buffer = Buffer.from(base64, 'base64');

    const path = `${req.orgId}/${Date.now()}_${filename}`;
    // TODO: integrate with real storage (S3/MinIO)
    const url = `/assets/${path}`;

    const { rows } = await req.db.query(
      `INSERT INTO assets (org_id, filename, url, metadata)
       VALUES ($1,$2,$3,$4)
       RETURNING id, filename, url, metadata, created_at`,
      [req.orgId, filename, url, JSON.stringify({ size: buffer.length })]
    );

    res.status(201).json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
}

export async function listPosts(req, res, next) {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 20, 1);
    const offset = (page - 1) * limit;

    const totalRes = await req.db.query(
      'SELECT COUNT(*) FROM posts WHERE org_id = $1',
      [req.orgId]
    );
    const total = Number(totalRes.rows[0]?.count || 0);

    const { rows } = await req.db.query(
      `SELECT p.id, p.title, p.content, p.channels, p.preview_asset,
              a.url AS preview_url, p.created_at, p.updated_at
         FROM posts p
         LEFT JOIN assets a ON a.id = p.preview_asset
        WHERE p.org_id = $1
        ORDER BY p.created_at DESC
        LIMIT $2 OFFSET $3`,
      [req.orgId, limit, offset]
    );

    res.json({ data: rows, meta: { page, limit, total } });
  } catch (err) {
    next(err);
  }
}

export async function getPost(req, res, next) {
  try {
    const { id } = req.params;
    const { rows } = await req.db.query(
      `SELECT p.id, p.title, p.content, p.channels, p.preview_asset,
              a.url AS preview_url, p.created_at, p.updated_at
         FROM posts p
         LEFT JOIN assets a ON a.id = p.preview_asset
        WHERE p.id = $1 AND p.org_id = $2`,
      [id, req.orgId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
}

export async function createPost(req, res, next) {
  try {
    const { title, content, channels = [], preview_asset } = req.body || {};
    if (!title) {
      return res.status(400).json({ error: 'invalid_input' });
    }
    const { rows } = await req.db.query(
      `INSERT INTO posts (org_id, title, content, channels, preview_asset)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, title, content, channels, preview_asset, created_at, updated_at`,
      [req.orgId, title, content || null, channels, preview_asset || null]
    );
    res.status(201).json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
}

export async function updatePost(req, res, next) {
  try {
    const { id } = req.params;
    const { title, content, channels = [], preview_asset } = req.body || {};
    const { rows } = await req.db.query(
      `UPDATE posts
          SET title = $1,
              content = $2,
              channels = $3,
              preview_asset = $4
        WHERE id = $5 AND org_id = $6
        RETURNING id, title, content, channels, preview_asset, created_at, updated_at`,
      [title, content || null, channels, preview_asset || null, id, req.orgId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
}
