import { pool, query } from '#db';
import { randomUUID } from 'crypto';
import { z } from 'zod';

const slugRegex = /^[a-z0-9\-]+$/;
const phoneRegex = /^\+?\d{10,15}$/;
const digits = /\D+/g;

function normalizeDigits(value = '') {
  return String(value ?? '')
    .replace(digits, '')
    .trim();
}

function mapOrganization(row = {}) {
  if (!row) return null;

  return {
    id: row.id,
    name: row.name || '',
    slug: row.slug || '',
    status: row.status || 'inactive',
    trial_ends_at: row.trial_ends_at || null,
    plan_id: row.plan_id || null,
    plan_name: row.plan_name || row.plan || null,
    email: row.email || row.resp_email || null,
    phone: row.phone || row.phone_e164 || null,
    cnpj: row.cnpj || row.document_value || null,
    cep: row.cep || null,
    street: row.street || row.logradouro || null,
    number: row.number || row.numero || null,
    complement: row.complement || row.complemento || null,
    neighborhood: row.neighborhood || row.bairro || null,
    city: row.city || row.cidade || null,
    state: row.state || row.uf || null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
  };
}

const baseOrgSchema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  slug: z
    .string()
    .min(2, 'Slug obrigatório')
    .regex(slugRegex, 'Use letras minúsculas, números e hífen'),
  status: z.enum(['active', 'inactive']).default('active'),
  email: z
    .string()
    .email('E-mail inválido')
    .optional()
    .or(z.literal('')),
  phone: z
    .string()
    .regex(phoneRegex, 'Telefone inválido')
    .optional()
    .or(z.literal('')),
  cnpj: z
    .string()
    .regex(/^\d{14}$/u, 'CNPJ deve ter 14 dígitos')
    .optional()
    .or(z.literal('')),
  cep: z
    .string()
    .regex(/^\d{8}$/u, 'CEP deve ter 8 dígitos')
    .optional()
    .or(z.literal('')),
  street: z.string().optional().or(z.literal('')),
  number: z.string().optional().or(z.literal('')),
  complement: z.string().optional().or(z.literal('')),
  neighborhood: z.string().optional().or(z.literal('')),
  city: z.string().min(2, 'Cidade obrigatória'),
  state: z
    .string()
    .min(2, 'UF deve ter 2 letras')
    .max(2, 'UF deve ter 2 letras')
    .transform((value) => value.toUpperCase()),
  plan_name: z.string().optional().or(z.literal('')),
  plan_id: z.string().optional().or(z.literal('')),
  trial_ends_at: z.string().optional().or(z.literal('')),
});

const partialOrgSchema = baseOrgSchema.partial();

function buildUpdateSet(parsed = {}) {
  const updates = [];
  const params = [];

  const push = (column, value) => {
    updates.push(`${column} = $${updates.length + 1}`);
    params.push(value);
  };

  if (parsed.name !== undefined) push('name', parsed.name || null);
  if (parsed.slug !== undefined) push('slug', parsed.slug || null);
  if (parsed.status !== undefined) push('status', parsed.status);
  if (parsed.email !== undefined)
    push('email', parsed.email ? parsed.email.toLowerCase() : null);
  if (parsed.phone !== undefined) {
    const phoneValue = parsed.phone ? parsed.phone.trim() : null;
    push('phone', phoneValue || null);
    push('phone_e164', phoneValue || null);
  }
  if (parsed.cnpj !== undefined)
    push('cnpj', parsed.cnpj ? normalizeDigits(parsed.cnpj) : null);
  if (parsed.cep !== undefined)
    push('cep', parsed.cep ? normalizeDigits(parsed.cep) : null);
  if (parsed.street !== undefined) push('logradouro', parsed.street || null);
  if (parsed.number !== undefined) push('numero', parsed.number || null);
  if (parsed.complement !== undefined)
    push('complemento', parsed.complement || null);
  if (parsed.neighborhood !== undefined)
    push('bairro', parsed.neighborhood || null);
  if (parsed.city !== undefined) push('cidade', parsed.city || null);
  if (parsed.state !== undefined) push('uf', parsed.state || null);
  if (parsed.plan_id !== undefined)
    push('plan_id', parsed.plan_id ? parsed.plan_id : null);
  if (parsed.plan_name !== undefined)
    push('plan_name', parsed.plan_name || null);
  if (parsed.trial_ends_at !== undefined)
    push('trial_ends_at', parsed.trial_ends_at || null);

  push('updated_at', new Date());

  return { updates, params };
}

export async function listAdmin(req, res, next) {
  try {
    const { status } = req.query || {};
    const params = [];
    const where = [];
    if (status && status !== 'all') {
      params.push(status);
      where.push(`o.status = $${params.length}`);
    }

    const sql = `
      SELECT o.id,
             o.name,
             o.slug,
             o.status,
             o.trial_ends_at,
             o.plan_id,
             COALESCE(o.plan_name, p.name, p.code) AS plan_name,
             o.created_at,
             o.updated_at
        FROM public.organizations o
        LEFT JOIN public.plans p ON p.id = o.plan_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY o.created_at DESC
       LIMIT 500
    `;
    const { rows } = await query(sql, params);
    res.json({
      currentOrgId: req.user?.org_id || null,
      items: (rows || []).map(mapOrganization),
    });
  } catch (e) {
    next(e);
  }
}

export async function listForMe(req, res, next) {
  try {
    const { id: directId, sub, roles = [], role } = req.user || {};
    const currentOrgId = req.user?.org_id ?? null;
    const roleSet = new Set([...(roles || []), role].filter(Boolean));
    const isGlobal = roleSet.has('SuperAdmin') || roleSet.has('Support');
    const userId = directId ?? sub ?? null;

    if (!isGlobal && !userId) {
      return res.json({ currentOrgId, items: [] });
    }

    const params = [];
    const sql = isGlobal
      ? `
        SELECT o.id, o.name, o.slug, o.status, o.plan_id, o.trial_ends_at
          FROM public.organizations o
         WHERE o.status = 'active'
         ORDER BY o.name ASC
         LIMIT 500
      `
      : `
        SELECT o.id, o.name, o.slug, o.status, o.plan_id, o.trial_ends_at
          FROM public.organizations o
          JOIN public.org_members m ON m.org_id = o.id AND m.user_id = $1
         ORDER BY o.name ASC
         LIMIT 500
      `;

    if (!isGlobal) params.push(userId);

    const client = req.db ?? pool;
    const { rows = [] } = await client.query(sql, params);

    return res.json({ items: rows, currentOrgId });
  } catch (e) {
    next(e);
  }
}

export async function getAdminById(req, res, next) {
  try {
    const { orgId } = req.params;
    const { rows } = await query(
      `SELECT o.*, COALESCE(o.plan_name, p.name, p.code) AS plan_name
         FROM public.organizations o
         LEFT JOIN public.plans p ON p.id = o.plan_id
        WHERE o.id = $1
        LIMIT 1`,
      [orgId],
    );

    const org = rows?.[0];
    if (!org) return res.status(404).json({ error: 'not_found' });
    res.json({ organization: mapOrganization(org) });
  } catch (e) {
    next(e);
  }
}

export async function createAdmin(req, res, next) {
  try {
    const parsed = baseOrgSchema.parse(req.body || {});
    const id = randomUUID();
    const cnpj = parsed.cnpj ? normalizeDigits(parsed.cnpj) : null;
    const cep = parsed.cep ? normalizeDigits(parsed.cep) : null;

    await query(
      `INSERT INTO public.organizations (
         id,
         name,
         slug,
         status,
         email,
         phone,
         phone_e164,
         cnpj,
         cep,
         logradouro,
         numero,
         complemento,
         bairro,
         cidade,
         uf,
         plan_id,
         plan_name,
         trial_ends_at,
         created_at,
         updated_at
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,now(),now()
       )`,
      [
        id,
        parsed.name,
        parsed.slug,
        parsed.status,
        parsed.email ? parsed.email.toLowerCase() : null,
        parsed.phone || null,
        parsed.phone || null,
        cnpj,
        cep,
        parsed.street || null,
        parsed.number || null,
        parsed.complement || null,
        parsed.neighborhood || null,
        parsed.city || null,
        parsed.state || null,
        parsed.plan_id || null,
        parsed.plan_name || null,
        parsed.trial_ends_at || null,
      ],
    );

    const { rows } = await query(
      `SELECT o.*, COALESCE(o.plan_name, p.name, p.code) AS plan_name
         FROM public.organizations o
         LEFT JOIN public.plans p ON p.id = o.plan_id
        WHERE o.id = $1`,
      [id],
    );

    res.status(201).json({ organization: mapOrganization(rows?.[0]) });
  } catch (e) {
    if (e?.name === 'ZodError') {
      return res.status(422).json({ error: 'validation', issues: e.issues });
    }
    next(e);
  }
}

export async function updateAdmin(req, res, next) {
  try {
    const { orgId } = req.params;
    const parsed = partialOrgSchema.parse(req.body || {});
    if (!Object.keys(parsed).length)
      return res.status(400).json({ error: 'no_fields_to_update' });

    if (parsed.cnpj) parsed.cnpj = normalizeDigits(parsed.cnpj);
    if (parsed.cep) parsed.cep = normalizeDigits(parsed.cep);

    const { updates, params } = buildUpdateSet(parsed);
    if (!updates.length) return res.json({ organization: null });

    params.push(orgId);

    await query(
      `UPDATE public.organizations
          SET ${updates.join(', ')}
        WHERE id = $${params.length}`,
      params,
    );

    const { rows } = await query(
      `SELECT o.*, COALESCE(o.plan_name, p.name, p.code) AS plan_name
         FROM public.organizations o
         LEFT JOIN public.plans p ON p.id = o.plan_id
        WHERE o.id = $1
        LIMIT 1`,
      [orgId],
    );

    const org = rows?.[0];
    if (!org) return res.status(404).json({ error: 'not_found' });
    res.json({ organization: mapOrganization(org) });
  } catch (e) {
    if (e?.name === 'ZodError') {
      return res.status(422).json({ error: 'validation', issues: e.issues });
    }
    next(e);
  }
}

export async function deleteAdmin(req, res, next) {
  try {
    const { orgId } = req.params;
    const result = await query(
      `DELETE FROM public.organizations WHERE id = $1 RETURNING id`,
      [orgId],
    );
    if (!result.rowCount) return res.status(404).json({ error: 'not_found' });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
}
