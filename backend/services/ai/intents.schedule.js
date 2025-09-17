// backend/services/ai/intents.schedule.js
// Extrator simples de intenção/entidades para pt-BR, sem dependências externas.

const WORDS = {
  schedule: /\b(agendar|marcar|agende|marque)\b/i,
  reschedule: /\b(remarcar|reagendar|remarque|reagende)\b/i,
  cancel: /\b(cancelar|cancele|cancela)\b/i,
  confirm: /\b(confirmar|confirmo|pode confirmar|ok|tudo bem)\b/i,
  deny: /\b(não|nao|prefiro outro|mudar|alterar)\b/i,
};

// hh:mm ou 14h / 14h30
const RE_TIME = /\b(?:(\d{1,2})h(?:(\d{2}))?|(\d{1,2}):(\d{2}))\b/;
// 23/09/2025 ou 23/09
const RE_DATE = /\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/;
// “dia 23”, “no dia 7”
const RE_DAY = /\bdia\s+(\d{1,2})\b/i;
// “às” é ruído frequente
const RE_AT = /\bàs\b/i;

// tenta dd/mm(/yyyy)
export function parseDateParts(text, now = new Date()) {
  if (!text) return null;
  const m1 = text.match(RE_DATE);
  if (m1) {
    let [, dd, mm, yyyy] = m1;
    dd = String(dd).padStart(2, '0');
    mm = String(mm).padStart(2, '0');
    if (!yyyy) yyyy = String(now.getFullYear());
    if (yyyy.length === 2) yyyy = `20${yyyy}`;
    return `${yyyy}-${mm}-${dd}`;
  }
  const m2 = text.match(RE_DAY);
  if (m2) {
    const dd = String(m2[1]).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = String(now.getFullYear());
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
}

// retorna "HH:MM"
export function parseTime(text) {
  if (!text) return null;
  const m = text.match(RE_TIME);
  if (!m) return null;
  if (m[1]) { // 14h or 14h30
    const H = String(m[1]).padStart(2, '0');
    const M = m[2] ? String(m[2]).padStart(2, '0') : '00';
    return `${H}:${M}`;
  }
  if (m[3] && m[4]) { // 14:30
    const H = String(m[3]).padStart(2, '0');
    const M = String(m[4]).padStart(2, '0');
    return `${H}:${M}`;
  }
  return null;
}

// limpa “às”
export function stripNoise(text) {
  if (!text) return '';
  return text.replace(RE_AT, ' ');
}

export function detectAction(text) {
  if (!text) return null;
  if (WORDS.reschedule.test(text)) return 'reschedule';
  if (WORDS.cancel.test(text)) return 'cancel';
  if (WORDS.schedule.test(text)) return 'schedule';
  return null;
}

export function isConfirm(text) {
  if (!text) return false;
  return WORDS.confirm.test(text);
}

export function isDeny(text) {
  if (!text) return false;
  return WORDS.deny.test(text);
}

// serviço “consulta”, “mentoria”… heurística simples
export function findServiceHint(text) {
  if (!text) return null;
  const m = text.match(/\b(consulta|mentoria|avalia(?:ç|c)ão|exame|retorno)\b/i);
  return m ? m[1].toLowerCase() : null;
}

// “com rodrigo”, “com o rodrigo”, “com a ana”
export function findPersonHint(text) {
  if (!text) return null;
  const m = text.match(/\bcom\s+(o|a)?\s*([a-zÀ-ÿ][\wÀ-ÿ]+)\b/i);
  return m ? m[2] : null;
}

export function normalizeISO(dateYYYYMMDD, hhmm, tzOffsetMinutes = -180 /* -03:00 */) {
  if (!dateYYYYMMDD || !hhmm) return null;
  const [H, M] = hhmm.split(':').map((n) => parseInt(n, 10));
  const [Y, Mo, D] = dateYYYYMMDD.split('-').map((n) => parseInt(n, 10));
  const local = new Date(Date.UTC(Y, Mo - 1, D, H, M, 0));
  const utcMs = local.getTime() + (tzOffsetMinutes * -1) * 60000;
  return new Date(utcMs).toISOString();
}
