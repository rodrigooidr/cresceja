import { Router } from 'express';
import { z } from 'zod';
import * as requireRoleMod from '../middleware/requireRole.js';
import { ROLES } from '../lib/permissions.js';
import { getProfile } from '../services/ai/profileService.js';
import { search as ragSearch } from '../services/ai/rag.js';
import { run as runInference } from '../services/ai/infer.js';

const router = Router();

const requireRole = requireRoleMod.requireRole ?? requireRoleMod.default?.requireRole ?? requireRoleMod.default ?? requireRoleMod;

const toolSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  args: z.record(z.any()).optional(),
});

const guardrailRuleSchema = z.object({
  type: z.string(),
  value: z.any().optional(),
  limit: z.number().optional(),
});

const sandboxProfileSchema = z.object({
  vertical: z.string().optional(),
  brandVoice: z.string().optional(),
  languages: z.array(z.string()).optional(),
  rag: z
    .object({
      enabled: z.boolean().optional(),
      topK: z.number().int().positive().optional(),
    })
    .optional(),
  tools: z.array(toolSchema).optional(),
  guardrails: z
    .object({
      pre: z.array(guardrailRuleSchema).optional(),
      post: z.array(guardrailRuleSchema).optional(),
      maxReplyChars: z.number().int().positive().optional(),
    })
    .optional(),
});

const requestSchema = z.object({
  message: z.string().min(1),
  useDraft: z.boolean().optional(),
  profile: sandboxProfileSchema.optional(),
});

const PRE_REFUSAL = 'Desculpe, não posso ajudar com isso.';
const POST_REFUSAL = 'Desculpe, não posso responder a isso.';

function evaluatePreChecks(profile, message) {
  const rules = profile?.guardrails?.pre || [];
  const lower = message.toLowerCase();

  for (const rule of rules) {
    if (rule.type === 'blockTopic' && rule.value) {
      const term = String(rule.value).toLowerCase();
      if (term && lower.includes(term)) {
        return { ok: false, rule: 'blockTopic', details: { term } };
      }
    }
  }

  return { ok: true };
}

function evaluatePostChecks(profile, reply) {
  const maxChars = profile?.guardrails?.maxReplyChars;
  if (maxChars && reply.length > maxChars) {
    return { ok: false, rule: 'maxLength', details: { limit: maxChars, length: reply.length } };
  }

  const rules = profile?.guardrails?.post || [];
  for (const rule of rules) {
    if (rule.type === 'maxLength' && typeof rule.limit === 'number' && reply.length > rule.limit) {
      return { ok: false, rule: 'maxLength', details: { limit: rule.limit, length: reply.length } };
    }
  }

  return { ok: true };
}

function composePrompt(profile, message, contextDocs) {
  const header = `Você é um assistente para o segmento ${profile?.vertical || 'geral'}.`;
  const docs = contextDocs
    .map((doc, idx) => `Doc ${idx + 1}: ${doc.text}`)
    .join('\n');
  return `${header}\nContexto:\n${docs}\nUsuário: ${message}`.trim();
}

async function recordViolation(db, { orgId, userId, stage, rule, details }) {
  if (!db?.query) return;
  await db.query(
    `INSERT INTO ai_guardrail_violations (org_id, stage, rule, payload, created_by)
     VALUES ($1, $2, $3, $4, $5)`,
    [orgId, stage, rule, details || null, userId || null]
  );
}

router.post(
  '/api/orgs/:orgId/ai/test',
  requireRole(ROLES.OrgAdmin, ROLES.SuperAdmin),
  async (req, res, next) => {
    try {
      const parsed = requestSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(422).json({ error: 'validation_error', issues: parsed.error.flatten() });
      }

      const { message, useDraft, profile: draftProfile } = parsed.data;
      const orgId = req.params.orgId;
      const profile = useDraft ? draftProfile || {} : await getProfile(orgId);

      const debug = { tokens: 0, toolCalls: [], contextDocs: [] };

      const pre = evaluatePreChecks(profile, message);
      if (!pre.ok) {
        debug.violations = [{ stage: 'pre', rule: pre.rule, details: pre.details }];
        await recordViolation(req.db, {
          orgId,
          userId: req.user?.id,
          stage: 'pre',
          rule: pre.rule,
          details: { ...pre.details, message },
        });
        return res.json({ reply: PRE_REFUSAL, debug });
      }

      const topK = profile?.rag?.topK || 3;
      const contextDocs = await ragSearch(orgId, message, { topK });
      debug.contextDocs = contextDocs;

      const prompt = composePrompt(profile, message, contextDocs);
      const inference = await runInference({ prompt, tools: profile?.tools || [] });
      debug.tokens = inference.tokens;
      debug.toolCalls = inference.toolCalls;

      let reply = inference.output;
      const post = evaluatePostChecks(profile, reply);
      if (!post.ok) {
        const violation = { stage: 'post', rule: post.rule, details: post.details };
        debug.violations = [...(debug.violations || []), violation];
        await recordViolation(req.db, {
          orgId,
          userId: req.user?.id,
          stage: 'post',
          rule: post.rule,
          details: { ...post.details, reply },
        });
        reply = POST_REFUSAL;
      }

      res.json({ reply, debug });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
