function escapeCSV(val) {
  if (val == null) return "";
  const s = String(val);
  const needQuotes = /[",\n;]/.test(s);
  const escaped = s.replace(/"/g, '""');
  return needQuotes ? `"${escaped}"` : escaped;
}

/** rows: Array<Object> */
export function toCSV(rows, { headers } = {}) {
  const data = Array.isArray(rows) ? rows : [];
  const cols = headers || (data[0] ? Object.keys(data[0]) : []);
  const head = cols.map(escapeCSV).join(";");
  const body = data.map((r) => cols.map((k) => escapeCSV(r[k])).join(";")).join("\n");
  return [head, body].filter(Boolean).join("\n");
}

/** Dispara download no browser (no Jest apenas retorna o blob/url). */
export function downloadCSV(filename, csv) {
  try {
    if (!filename) {
      try {
        const iso = new Date().toISOString().replace(/[:.]/g, "-");
        filename = `gov-logs-${iso}.csv`;
      } catch {}
    }
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "export.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    return { blob, url };
  } catch {
    return null;
  }
}

export default { toCSV, downloadCSV };
