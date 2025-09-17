// backend/services/ai/scheduler.bot.js

import { query } from '#db';
import http from 'node:http';
import fetch from 'node-fetch';
import {
  detectAction,
  isConfirm,
  isDeny,
  parseDateParts,
  parseTime,
  stripNoise,
  findServiceHint,
  findPersonHint,
  normalizeISO,
} from './intents.schedule.js';

const TZ_OFFSET_MIN = -180; // America/Sao_Paulo (~-03:00)

async function getPeople(orgId) {
  const sql = `
    SELECT name, permissions_json
    FROM public.channel_accounts
    WHERE org_id = $1 AND channel = 'google_calendar' AND name IS NOT NULL
  `;
  const { rows = [] } = await query(sql, [orgId]);
  return rows.map((row) => {
    const raw = row.permissions_json;
    let parsed;
    if (Array.isArray(raw) || (raw && typeof raw === 'object')) {
      parsed = raw;
    } else if (typeof raw === 'string') {
      try { parsed = JSON.parse(raw); } catch { parsed = {}; }
    } else {
      parsed = {};
    }
    return {
      name: row.name,
      aliases: Array.isArray(parsed?.aliases) ? parsed.aliases : [],
      skills: Array.isArray(parsed?.skills) ? parsed.skills : [],
      slotMin: parsed?.slotMin || 30,
    };
  });
}

async function getServices(orgId) {
  const sql = `
    SELECT collect_fields
    FROM public.org_ai_settings
    WHERE org_id = $1
  `;
  const { rows = [] } = await query(sql, [orgId]);
  const raw = rows[0]?.collect_fields;
  let cf;
  if (Array.isArray(raw) || (raw && typeof raw === 'object')) {
    cf = raw;
  } else if (typeof raw === 'string') {
    try { cf = JSON.parse(raw); } catch { cf = {}; }
  } else {
    cf = {};
  }
  const items = Array.isArray(cf?.appointment_services) ? cf.appointment_services : [];
  return items.map((s) => ({
    name: s.name,
    durationMin: s.durationMin || 30,
    defaultSkill: s.defaultSkill || null,
  }));
}

function resolvePersonName(hint, people) {
  if (!hint) return null;
  const h = hint.toLowerCase();
  for (const p of people) {
    if (p.name?.toLowerCase() === h) return p.name;
    if (Array.isArray(p.aliases) && p.aliases.some((a) => String(a).toLowerCase() === h)) {
      return p.name;
    }
  }
  const byPrefix = people.find((p) =>
    p.name?.toLowerCase().startsWith(h) ||
    (p.aliases || []).some((a) => String(a).toLowerCase().startsWith(h))
  );
  return byPrefix ? byPrefix.name : null;
}

function resolveServiceName(hint, services) {
  if (!hint) return null;
  const h = hint.toLowerCase();
  const exact = services.find((s) => s.name?.toLowerCase() === h);
  if (exact) return exact.name;
  const pref = services.find((s) => s.name?.toLowerCase().startsWith(h));
  return pref ? pref.name : null;
}

async function loadState(conversationId) {
  if (!conversationId) return null;
  const { rows = [] } = await query(
    'SELECT ai_status FROM public.conversations WHERE id = $1',
    [conversationId],
  );
  const raw = rows[0]?.ai_status || '';
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function saveState(conversationId, state) {
  if (!conversationId) return;
  const payload = state ? JSON.stringify(state) : '';
  await query(
    'UPDATE public.conversations SET ai_status = $2, updated_at = now() WHERE id = $1',
    [conversationId, payload],
  );
}

function reply(text) {
  return { type: 'text', text };
}

function chips(options) {
  return { type: 'options', options };
}

function httpLocal(method, path, body) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      method,
      host: '127.0.0.1',
      port: process.env.PORT || 4000,
      path,
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      },
    }, (res) => {
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        try {
          resolve({ status: res.statusCode, json: JSON.parse(text) });
        } catch {
          resolve({ status: res.statusCode, text });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function handleSuggest(personName, skill, fromISO, durationMin) {
  const url = new URL('/api/calendar/suggest', `http://127.0.0.1:${process.env.PORT || 4000}`);
  if (personName) url.searchParams.set('personName', personName);
  if (skill) url.searchParams.set('skill', skill);
  if (fromISO) url.searchParams.set('fromISO', fromISO);
  url.searchParams.set('durationMin', String(durationMin || 30));
  try {
    const res = await fetch(url.toString());
    if (!res.ok) return { ok: false };
    const js = await res.json();
    const first = js?.items && Object.values(js.items)[0];
    if (!Array.isArray(first) || first.length === 0) return { ok: false };
    return { ok: true, slots: first.slice(0, 3) };
  } catch {
    return { ok: false };
  }
}

function addMinutesISO(startISO, minutes) {
  return new Date(new Date(startISO).getTime() + minutes * 60000).toISOString();
}

async function bookEvent({ personName, serviceName, contact, startISO, endISO, conversationId }) {
  const payload = {
    personName,
    summary: serviceName || 'Atendimento',
    startISO,
    endISO,
    attendeeEmail: contact?.email || undefined,
    attendeeName: contact?.display_name || undefined,
    contactId: contact?.id || undefined,
    conversationId,
  };
  return httpLocal('POST', '/api/calendar/events', payload);
}

export async function handleIncoming({ orgId, conversationId, text, contact }) {
  const now = new Date();
  const clean = stripNoise(text || '');
  let state = await loadState(conversationId);
  const action = detectAction(clean);
  const hasOngoing = !!state && state?.flow === 'schedule';

  if (hasOngoing && !action) {
    const people = await getPeople(orgId);
    const services = await getServices(orgId);
    const draft = { ...(state.draft || {}) };
    const messages = [];

    if (!draft.personName) {
      const hint = resolvePersonName(findPersonHint(clean), people);
      if (hint) draft.personName = hint;
    }
    if (!draft.serviceName) {
      const hint = resolveServiceName(findServiceHint(clean), services);
      if (hint) draft.serviceName = hint;
    }
    if (!draft.date) {
      const d = parseDateParts(clean, now);
      if (d) draft.date = d;
    }
    if (!draft.time) {
      const t = parseTime(clean);
      if (t) draft.time = t;
    }

    if (state.step === 'confirm') {
      if (isConfirm(clean)) {
        const startISO = state.proposal?.startISO;
        const endISO = state.proposal?.endISO;
        if (!startISO || !endISO) {
          messages.push(reply('Desculpe, perdi o horário proposto. Vamos tentar novamente.'));
          state = null;
          await saveState(conversationId, state);
          return { handled: true, messages };
        }
        const booked = await bookEvent({
          personName: draft.personName,
          serviceName: draft.serviceName,
          contact,
          startISO,
          endISO,
          conversationId,
        });
        if (booked.status === 409) {
          messages.push(reply('Esse horário acabou de ficar indisponível. Seguem novas sugestões:'));
          const svcObj = services.find((s) => s.name === draft.serviceName) || null;
          const dur = svcObj?.durationMin || 30;
          const suggested = await handleSuggest(draft.personName || null, svcObj?.defaultSkill || null, startISO, dur);
          if (suggested.ok) {
            const opts = suggested.slots.map((slot, idx) => `${idx + 1}) ${new Date(slot.start).toLocaleString()} → ${new Date(slot.end).toLocaleTimeString()}`);
            messages.push(chips(opts));
            state.step = 'pick_slot';
            state.suggestions = suggested.slots;
            await saveState(conversationId, state);
            return { handled: true, messages };
          }
          messages.push(reply('Sem horários próximos. Quer tentar outro horário ou profissional?'));
          state.step = 'awaiting_datetime';
          await saveState(conversationId, state);
          return { handled: true, messages };
        }
        messages.push(reply('Agendado com sucesso! Você receberá um lembrete.'));
        state = null;
        await saveState(conversationId, state);
        return { handled: true, messages };
      }
      if (isDeny(clean)) {
        const prompt = draft.personName
          ? 'Sem problemas. Qual horário você prefere?'
          : 'Sem problemas. Qual profissional e horário você prefere?';
        messages.push(reply(prompt));
        state.step = 'awaiting_all';
        state.draft = draft;
        await saveState(conversationId, state);
        return { handled: true, messages };
      }
    }

    if (state.step === 'pick_slot') {
      const number = parseInt(clean.trim(), 10);
      if (!Number.isNaN(number) && state.suggestions?.[number - 1]) {
        const chosen = state.suggestions[number - 1];
        const booked = await bookEvent({
          personName: draft.personName,
          serviceName: draft.serviceName,
          contact,
          startISO: chosen.start,
          endISO: chosen.end,
          conversationId,
        });
        if (booked.status === 409) {
          const next = state.suggestions[number] || null;
          if (next) {
            state.proposal = { startISO: next.start, endISO: next.end };
            state.step = 'confirm';
            await saveState(conversationId, state);
            return { handled: true, messages: [reply('Esse horário ficou indisponível. Podemos confirmar o próximo sugerido? (responda "confirmar")')] };
          }
          state.step = 'awaiting_datetime';
          await saveState(conversationId, state);
          return { handled: true, messages: [reply('Sem disponibilidade. Informe outro dia/horário, por favor.')] };
        }
        await saveState(conversationId, null);
        return { handled: true, messages: [reply('Agendado com sucesso!')] };
      }
    }

    if (draft.personName && draft.date && draft.time) {
      const svcObj = services.find((s) => s.name === draft.serviceName) || null;
      const dur = svcObj?.durationMin || 30;
      const startISO = normalizeISO(draft.date, draft.time, TZ_OFFSET_MIN);
      const endISO = addMinutesISO(startISO, dur);
      const suggested = await handleSuggest(draft.personName, svcObj?.defaultSkill || null, startISO, dur);
      if (suggested.ok && suggested.slots?.length) {
        const best = suggested.slots.find((slot) => new Date(slot.start).getTime() === new Date(startISO).getTime()) || suggested.slots[0];
        state.flow = 'schedule';
        state.step = 'confirm';
        state.draft = draft;
        state.proposal = { startISO: best.start, endISO: best.end };
        await saveState(conversationId, state);
        return {
          handled: true,
          messages: [
            reply(`Posso agendar ${draft.serviceName || 'atendimento'} com ${draft.personName} em ${new Date(best.start).toLocaleString()}? Responda "confirmar" para prosseguir.`),
            chips(['confirmar', 'mudar horário', 'mudar profissional']),
          ],
        };
      }
      state.step = 'awaiting_datetime';
      state.draft = draft;
      await saveState(conversationId, state);
      return { handled: true, messages: [reply('Não encontrei disponibilidade nesse horário. Pode indicar outro horário ou dia?')] };
    }

    const missing = [];
    if (!draft.personName) missing.push('profissional');
    if (!draft.date || !draft.time) missing.push('data e hora');
    const ask = `Para agendar preciso de ${missing.join(' e ')}. Pode me informar?`;
    state.flow = 'schedule';
    state.step = 'awaiting_all';
    state.draft = draft;
    await saveState(conversationId, state);
    return { handled: true, messages: [reply(ask)] };
  }

  if (!action) return { handled: false };

  if (action === 'cancel') {
    await saveState(conversationId, { flow: 'schedule', step: 'cancel_await', draft: {} });
    return { handled: true, messages: [reply('Claro, posso cancelar. Informe o dia e horário do agendamento a cancelar, por favor.')] };
  }

  if (action === 'reschedule') {
    await saveState(conversationId, { flow: 'schedule', step: 'resched_await', draft: {} });
    return { handled: true, messages: [reply('Vamos remarcar então. Qual novo dia e horário você prefere? E mantém o mesmo profissional?')] };
  }

  const people = await getPeople(orgId);
  const services = await getServices(orgId);

  const draft = {
    personName: resolvePersonName(findPersonHint(clean), people),
    serviceName: resolveServiceName(findServiceHint(clean), services),
    date: parseDateParts(clean, now),
    time: parseTime(clean),
  };

  if (!draft.personName || !draft.date || !draft.time) {
    const missing = [];
    if (!draft.personName) missing.push('profissional');
    if (!draft.date || !draft.time) missing.push('data e hora');
    await saveState(conversationId, { flow: 'schedule', step: 'awaiting_all', draft });
    return { handled: true, messages: [reply(`Vamos lá! Para agendar preciso de ${missing.join(' e ')}. Com quem e para quando?`)] };
  }

  const svcObj = services.find((s) => s.name === draft.serviceName) || null;
  const dur = svcObj?.durationMin || 30;
  const startISO = normalizeISO(draft.date, draft.time, TZ_OFFSET_MIN);
  const suggested = await handleSuggest(draft.personName, svcObj?.defaultSkill || null, startISO, dur);
  if (suggested.ok && suggested.slots?.length) {
    const best = suggested.slots.find((slot) => new Date(slot.start).getTime() === new Date(startISO).getTime()) || suggested.slots[0];
    const newState = { flow: 'schedule', step: 'confirm', draft, proposal: { startISO: best.start, endISO: best.end } };
    await saveState(conversationId, newState);
    return {
      handled: true,
      messages: [
        reply(`Posso agendar ${draft.serviceName || 'atendimento'} com ${draft.personName} em ${new Date(best.start).toLocaleString()}? Responda "confirmar".`),
        chips(['confirmar', 'mudar horário', 'mudar profissional']),
      ],
    };
  }
  await saveState(conversationId, { flow: 'schedule', step: 'awaiting_datetime', draft });
  return { handled: true, messages: [reply('Não encontrei disponibilidade nesse horário. Quer tentar outro horário?')] };
}
