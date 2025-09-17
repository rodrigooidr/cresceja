import { Router } from 'express';
import { query } from '#db';
import * as authModule from '../middleware/auth.js';
import transcriptionModule from '../services/transcription.js';

const router = Router();
const requireAuth =
  authModule?.requireAuth ||
  authModule?.authRequired ||
  authModule?.default ||
  ((_req, _res, next) => next());

router.use(requireAuth);

function extractText(result) {
  if (!result) return null;
  if (typeof result === 'string') return result;
  if (typeof result.text === 'string') return result.text;
  if (typeof result?.data?.text === 'string') return result.data.text;
  if (Array.isArray(result?.results)) {
    const first = result.results.find((r) => typeof r.text === 'string');
    if (first) return first.text;
  }
  return null;
}

async function performTranscription(params) {
  const candidates = [transcriptionModule, transcriptionModule?.default].filter(Boolean);

  for (const mod of candidates) {
    if (typeof mod?.transcribeFromStorage === 'function') {
      const output = await mod.transcribeFromStorage(params);
      const text = extractText(output);
      if (text) return text;
    }
  }

  for (const mod of candidates) {
    if (typeof mod?.transcribeAudio === 'function') {
      const output = await mod.transcribeAudio(params.key, params.mime, params.orgId);
      const text = extractText(output);
      if (text) return text;
    }
  }

  return null;
}

router.post('/inbox/messages/:id/transcribe', async (req, res, next) => {
  try {
    const id = req.params.id;

    const message = await query(`SELECT org_id FROM public.messages WHERE id = $1`, [id]);
    if (!message.rowCount) {
      return res.status(404).json({ error: 'message_not_found' });
    }
    const orgId = message.rows[0].org_id;

    const attachment = await query(
      `SELECT path_or_key AS key, mime
         FROM public.message_attachments
        WHERE message_id = $1
          AND (mime ILIKE 'audio/%' OR kind = 'audio')
        ORDER BY COALESCE(idx, 0) ASC, created_at ASC
        LIMIT 1`,
      [id]
    );

    if (!attachment.rowCount) {
      return res.status(400).json({ error: 'no_audio_attachment' });
    }

    const { key, mime } = attachment.rows[0];
    const text = await performTranscription({ key, mime, orgId });

    if (!text) {
      return res.status(501).json({ error: 'transcription_service_unavailable' });
    }

    await query(
      `INSERT INTO public.message_transcripts (id, org_id, message_id, provider, language, text, created_at)
       VALUES (gen_random_uuid(), $1, $2, 'whisper', NULL, $3, now())
       ON CONFLICT (message_id) DO UPDATE SET text = EXCLUDED.text`,
      [orgId, id, text]
    );

    await query(`UPDATE public.messages SET transcript = $2, updated_at = now() WHERE id = $1`, [id, text]);

    res.json({ ok: true, transcript: text });
  } catch (err) {
    next(err);
  }
});

export default router;
