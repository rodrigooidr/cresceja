// scripts/guardrail-inbox.js
const fs = require("fs");
const p = require("path");

const roots = ["src/pages/inbox", "src/components/inbox"];
const files = [];

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const fp = p.join(dir, name);
    const st = fs.statSync(fp);
    if (st.isDirectory()) walk(fp);
    else if (/\.(jsx?|tsx?)$/.test(name)) files.push(fp);
  }
}

roots.forEach(walk);

const bad = [];
const rx = /(fetch\(|axios\.(get|post|put|delete)\(|(^|[^a-zA-Z])\/api\/)/;

for (const fp of files) {
  const lines = fs.readFileSync(fp, "utf8").split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // ignorar linhas de import
    if (/^\s*import\s/.test(line)) continue;
    if (rx.test(line)) bad.push(`${fp}:${i + 1} ${line.trim()}`);
  }
}

if (bad.length) {
  console.error("Violação(s):\n" + bad.join("\n"));
  process.exit(1);
} else {
  console.log("OK");
}
