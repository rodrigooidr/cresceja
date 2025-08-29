// backend/tools/scan-esm.js
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';

const ROOT = process.cwd(); // backend/
const targets = [
  path.join(ROOT, 'server.js'),
  path.join(ROOT, 'routes'),
  path.join(ROOT, 'services'),
];

const issues = [];

async function walk(dir, list = []) {
  try {
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) await walk(p, list);
      else if (/\.(mjs|cjs|js)$/.test(e.name)) list.push(p);
    }
  } catch {}
  return list;
}

function has(str, re) { return re.test(str); }

function analyzeFile(file, text) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  const isRoute = rel.startsWith('routes/');
  const isJs = file.endsWith('.js');
  const problems = [];

  const usesRequire = has(text, /\brequire\s*\(/);
  const usesModuleExports = has(text, /module\.exports/);
  const hasImport = has(text, /\bimport\s+[^;]+from\s+['"].+['"]/);
  const hasExportDefault = has(text, /\bexport\s+default\b/);
  const createsRouter = has(text, /express\.Router\s*\(/);
  const importsCjs = has(text, /\.cjs(['"])/);

  if (importsCjs) problems.push('import de .cjs — padronize para .js');
  if (isJs && (usesRequire || usesModuleExports)) problems.push('CommonJS dentro de .js — converter para ESM');
  if (isRoute && createsRouter && !hasExportDefault) problems.push('Router sem "export default router"');
  if (isJs && !hasImport && (usesRequire || usesModuleExports)) problems.push('Sem imports ESM, mas usa CommonJS');

  if (problems.length) issues.push({ file: rel, problems });
}

async function scan() {
  const files = [];
  for (const t of targets) {
    const stat = fs.existsSync(t) ? fs.statSync(t) : null;
    if (!stat) continue;
    if (stat.isDirectory()) (await walk(t)).forEach(f => files.push(f));
    else files.push(t);
  }

  for (const f of files) {
    const txt = await fsp.readFile(f, 'utf8');
    analyzeFile(f, txt);
  }

  // checar duplicidades no server.js
  const srv = path.join(ROOT, 'server.js');
  if (fs.existsSync(srv)) {
    const s = await fsp.readFile(srv, 'utf8');
    const importNames = [...s.matchAll(/import\s+([a-zA-Z0-9_$]+)\s+from\s+['"][^'"]+['"]/g)].map(m => m[1]);
    const dupImports = importNames.filter((n, i, a) => a.indexOf(n) !== i);
    if (dupImports.length) {
      issues.push({ file: 'server.js', problems: [`Imports duplicados: ${[...new Set(dupImports)].join(', ')}`] });
    }
    const mountPaths = [...s.matchAll(/app\.use\(\s*['"]([^'"]+)['"]/g)].map(m => m[1]);
    const dupMounts = mountPaths.filter((n, i, a) => a.indexOf(n) !== i);
    if (dupMounts.length) {
      issues.push({ file: 'server.js', problems: [`app.use() duplicado em: ${[...new Set(dupMounts)].join(', ')}`] });
    }
  }

  if (!issues.length) {
    console.log('✅ Scanner: nenhum problema detectado nos alvos (server.js, routes/, services/).');
    return;
  }
  console.log('⚠️  Problemas encontrados:');
  for (const it of issues) {
    console.log(`- ${it.file}`);
    for (const p of it.problems) console.log(`   • ${p}`);
  }
  process.exitCode = 1;
}

scan().catch(err => {
  console.error('Scanner falhou:', err);
  process.exit(2);
});
