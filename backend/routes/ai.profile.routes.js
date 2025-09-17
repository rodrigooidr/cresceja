import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../middleware/requireRole.js';
import { ROLES } from '../lib/permissions.js';
import { getProfile, updateProfile } from '../services/ai/profileService.js';

const router = Router();

const toolSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  args: z.record(z.any()).optional(),
});

const policySchema = z.object({
  id: z.string().optional(),
  title: z.string().optional(),
  content: z.string(),
});

const guardrailRuleSchema = z.object({
  type: z.string(),
  value: z.any().optional(),
  limit: z.number().optional(),
});

const profileSchema = z.object({
  vertical: z.string().optional(),
  brandVoice: z.string().optional(),
  languages: z.array(z.string()).optional(),
  businessHours: z.record(z.any()).optional(),
  tools: z.array(toolSchema).optional(),
  rag: z
    .object({
      enabled: z.boolean().optional(),
      topK: z.number().int().positive().optional(),
    })
    .optional(),
  guardrails: z
    .object({
      pre: z.array(guardrailRuleSchema).optional(),
      post: z.array(guardrailRuleSchema).optional(),
      maxReplyChars: z.number().int().positive().optional(),
    })
    .optional(),
  policies: z.array(policySchema).optional(),
  fewShot: z
    .array(
      z.object({
        role: z.string().optional(),
        content: z.string(),
      })
    )
    .optional(),
});

router.get(
  '/api/orgs/:orgId/ai-profile',
  requireRole(ROLES.OrgAdmin, ROLES.SuperAdmin),
  async (req, res, next) => {
    try {
      const profile = await getProfile(req.params.orgId);
      res.json(profile);
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/api/orgs/:orgId/ai-profile',
  requireRole(ROLES.OrgAdmin, ROLES.SuperAdmin),
  async (req, res, next) => {
    try {
      const validation = profileSchema.safeParse(req.body || {});
      if (!validation.success) {
        return res.status(422).json({
          error: 'validation_error',
          issues: validation.error.flatten(),
        });
      }

      const saved = await updateProfile(req.params.orgId, validation.data, req.user?.id || null);
      res.json(saved);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
