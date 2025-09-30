export const onlyDigits = (s = "") => (s || "").toString().replace(/\D+/g, "");

export function formatCNPJ(input = "") {
  const v = onlyDigits(input).slice(0, 14);
  let out = v;
  if (v.length > 2) out = `${v.slice(0, 2)}.${v.slice(2)}`;
  if (v.length > 5) out = `${out.slice(0, 6)}.${out.slice(6)}`;
  if (v.length > 8) out = `${out.slice(0, 10)}/${out.slice(10)}`;
  if (v.length > 12) out = `${out.slice(0, 15)}-${out.slice(15)}`;
  return out;
}

export function formatCEP(input = "") {
  const v = onlyDigits(input).slice(0, 8);
  if (v.length <= 5) return v;
  return `${v.slice(0, 5)}-${v.slice(5)}`;
}

export function formatCPF(input = "") {
  const v = onlyDigits(input).slice(0, 11);
  let out = v;
  if (v.length > 3) out = `${v.slice(0, 3)}.${v.slice(3)}`;
  if (v.length > 6) out = `${out.slice(0, 7)}.${out.slice(7)}`;
  if (v.length > 9) out = `${out.slice(0, 11)}-${out.slice(11)}`;
  return out;
}

export function isValidCPF(input = "") {
  const v = onlyDigits(input);
  if (v.length !== 11) return false;
  if (/^(\d)\1+$/.test(v)) return false;
  const calc = (base) => {
    let sum = 0;
    for (let i = 0; i < base.length; i += 1) {
      sum += parseInt(base[i], 10) * (base.length + 1 - i);
    }
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  const d1 = calc(v.slice(0, 9));
  const d2 = calc(v.slice(0, 9) + d1);
  return v.endsWith(`${d1}${d2}`);
}

export function formatPhoneBR(input = "") {
  const v = onlyDigits(input).slice(0, 11);
  if (v.length <= 2) return v;
  if (v.length <= 6) return `(${v.slice(0, 2)}) ${v.slice(2)}`;
  if (v.length === 10) return `(${v.slice(0, 2)}) ${v.slice(2, 6)}-${v.slice(6)}`;
  return `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
}

export function toE164BR(input = "") {
  const raw = (input || "").trim();
  if (!raw) return null;
  if (raw.startsWith("+")) {
    const d = onlyDigits(raw);
    return d ? `+${d}` : null;
  }
  const d = onlyDigits(raw);
  if (d.length < 10) return null;
  return `+55${d}`;
}
