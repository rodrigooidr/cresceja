const COMPAT_ORG_ID = process.env.COMPAT_INBOX_ORG_ID || '00000000-0000-0000-0000-000000000000';

let ensured = false;
async function ensureSchema(pool) {
  if (ensured) return;
  await pool.query(`ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS status TEXT`);
  await pool.query(`ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS channel TEXT`);
  await pool.query(`ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS birthdate DATE`);
  await pool.query(`ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}'::TEXT[]`);
  ensured = true;
}

function mapContact(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name || '',
    phone: row.phone_e164 || '',
    email: row.email || '',
    birthday: row.birthdate ? new Date(row.birthdate).toISOString().slice(0, 10) : null,
    status: row.status || null,
    notes: row.notes || null,
    channel: row.channel || 'whatsapp',
    tags: Array.isArray(row.tags) ? row.tags : [],
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function getByPhone(pool, phone) {
  if (!phone) return null;
  await ensureSchema(pool);
  const { rows } = await pool.query(
    'SELECT * FROM public.contacts WHERE phone_e164 = $1 LIMIT 1',
    [phone]
  );
  return mapContact(rows[0]);
}

async function createContact(pool, data) {
  await ensureSchema(pool);
  const birthday = data.birthday ? new Date(data.birthday) : null;
  const tags = Array.isArray(data.tags) ? data.tags : null;
  const { rows } = await pool.query(
    `INSERT INTO public.contacts (org_id, name, phone_e164, email, birthdate, status, notes, channel, tags, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, '{}'::TEXT[]), now(), now())
     RETURNING *`,
    [
      COMPAT_ORG_ID,
      data.name || '',
      data.phone || null,
      data.email || null,
      birthday,
      data.status || null,
      data.notes || null,
      data.channel || 'whatsapp',
      tags,
    ]
  );
  return mapContact(rows[0]);
}

async function updateContact(pool, id, patch = {}) {
  await ensureSchema(pool);
  const sets = [];
  const values = [];
  let idx = 1;

  const mapping = {
    name: 'name',
    phone: 'phone_e164',
    email: 'email',
    birthday: 'birthdate',
    status: 'status',
    notes: 'notes',
    channel: 'channel',
    tags: 'tags',
  };

  for (const [key, column] of Object.entries(mapping)) {
    if (patch[key] === undefined) continue;
    let value = patch[key];
    if (key === 'birthday' && value) {
      value = new Date(value);
    }
    if (key === 'tags' && value != null) {
      if (!Array.isArray(value)) continue;
    }
    sets.push(`${column} = $${idx}`);
    values.push(value);
    idx += 1;
  }

  if (!sets.length) {
    const { rows } = await pool.query('SELECT * FROM public.contacts WHERE id = $1', [id]);
    return mapContact(rows[0]);
  }

  sets.push('updated_at = now()');
  const { rows } = await pool.query(
    `UPDATE public.contacts SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
    [...values, id]
  );
  return mapContact(rows[0]);
}

async function addTag(pool, id, tag) {
  if (!tag) {
    const { rows } = await pool.query('SELECT * FROM public.contacts WHERE id = $1', [id]);
    return mapContact(rows[0]);
  }
  await ensureSchema(pool);
  const { rows } = await pool.query(
    `UPDATE public.contacts
       SET tags = CASE
         WHEN COALESCE(tags, '{}'::TEXT[]) @> ARRAY[$2::TEXT] THEN tags
         ELSE array_append(COALESCE(tags, '{}'::TEXT[]), $2::TEXT)
       END,
           updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [id, tag]
  );
  return mapContact(rows[0]);
}

function listStatuses() {
  return ['novo', 'em_andamento', 'cliente', 'perdido'];
}

export {
  getByPhone,
  createContact,
  updateContact,
  addTag,
  listStatuses,
};
