import { query } from '#db';

export async function search(orgId, queryText, opts = {}) {
  const { topK = 5 } = opts;
  const limit = Math.max(1, Math.min(Number(topK) || 1, 20));

  const { rows } = await query(
    `SELECT title, uri, lang, tags, source_type, meta
       FROM kb_documents
      WHERE org_id = $1
      ORDER BY created_at DESC
      LIMIT $2`,
    [orgId, limit]
  );

  const docs = Array.isArray(rows) ? rows.slice(0, limit) : [];

  return docs.map((row, index) => ({
    text:
      row.title ||
      row.meta?.text ||
      `Documento ${index + 1} para ${queryText || 'consulta'}`,
    meta: {
      sourceType: row.source_type,
      uri: row.uri,
      lang: row.lang,
      tags: row.tags || [],
      ...(row.meta || {}),
    },
  }));
}
