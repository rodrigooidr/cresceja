import { query } from '#db';

export async function ingest(orgId, doc) {
  const now = new Date();
  const payload = {
    source_type: doc?.source_type || 'upload',
    uri: doc?.uri || null,
    lang: doc?.lang || null,
    title: doc?.title || null,
    tags: Array.isArray(doc?.tags) ? doc.tags : [],
  };

  const { rows } = await query(
    `INSERT INTO kb_documents (org_id, source_type, uri, lang, title, tags, meta, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, org_id, source_type, uri, lang, title, tags, meta, created_at`,
    [
      orgId,
      payload.source_type,
      payload.uri,
      payload.lang,
      payload.title,
      payload.tags,
      doc?.meta || null,
      now,
    ]
  );

  return rows?.[0] || null;
}

export async function reindex(orgId) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS count
       FROM kb_documents
      WHERE org_id = $1`,
    [orgId]
  );

  const countValue = rows?.[0]?.count ?? 0;
  const count = typeof countValue === 'number' ? countValue : Number(countValue) || 0;
  return { ok: true, indexed: count };
}
