// backend/tools/fix-esm.js
// Converte CommonJS -> ESM em server.js, routes/*.js e services/*.js
// - troca require/module.exports por import/export
// - garante export default router nas rotas com express.Router()
// - adiciona extensão .js em imports relativos quando faltar
// Cria backups .bak antes de salvar.

import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';

const ROOT = process.cwd(); // backend/
const TARGETS = [
  path.join(ROOT, 'server.js'),
  path.join(ROOT, 'routes'),
  path.join(ROOT, 'services'),
];

function listJs(dirOrFile) {
  const out = [];
  if (!fs.existsSync(dirOrFile)) return out;
  const st = fs.statSync(dirOrFile);
  if (st.isFile() && /\.(js|mjs)$/.test(dirOrFile)) return [dirOrFile];
  if (st.isDirectory()) {
    for (const name of fs.readdirSync(dirOrFile)) {
      out.push(...listJs(path.join(dirOrFile, name)));
    }
  }
  return out;
}

// adiciona .js em imports relativos sem extensão
function normalizeRelative(spec) {
  if (!spec.startsWith('.')) return spec;
  if (/\.(mjs|cjs|js|json)$/i.test(spec)) return spec;
  return spec + '.js';
}

function transformCJS2ESM(source) {
  let code = source;

  // 1) exports.something = ...
  code = code.replace(/(^|\s)exports\.([A-Za-z0-9_$]+)\s*=\s*([^\n;]+);?/g, (m, p1, name, rhs) => {
    return `${p1}export const ${name} = ${rhs};`;
  });

  // 2) module.exports = router;
  code = code.replace(/module\.exports\s*=\s*router\s*;?/g, 'export default router;');

  // 3) module.exports = IDENT
  code = code.replace(/module\.exports\s*=\s*([A-Za-z0-9_$]+)\s*;?/g, 'export default $1;');

  // 4) module.exports = { ... }
  code = code.replace(/module\.exports\s*=\s*\{/g, 'export default {');

  // 5) const { A,B } = require('mod');
  code = code.replace(/const\s*\{\s*([^}]+)\s*\}\s*=\s*require\(\s*['"]([^'"]+)['"]\s*\)\s*;?/g,
    (m, names, mod) => `import { ${names.trim()} } from '${normalizeRelative(mod)}';`);

  // 6) const X = require('mod');
  code = code.replace(/const\s+([A-Za-z0-9_$]+)\s*=\s*require\(\s*['"]([^'"]+)['"]\s*\)\s*;?/g,
    (m, name, mod) => `import ${name} from '${normalizeRelative(mod)}';`);

  // 7) require('mod'); (side-effect)
  code = code.replace(/require\(\s*['"]([^'"]+)['"]\s*\)\s*;?/g,
    (m, mod) => `import '${normalizeRelative(mod)}';`);

  // 8) Caso tenha import sem extensão relativa -> adiciona .js
  code = code.replace(/import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g, (m, what, mod) => {
    return `import ${what} from '${normalizeRelative(mod)}'`;
  });

  // 9) Garante export default router se cria Router e não tem export default
  const createsRouter = /express\.Router\s*\(/.test(code);
  const hasExportDefault = /\bexport\s+default\b/.test(code);
  if (createsRouter && !hasExportDefault && /const\s+router\s*=/.test(code)) {
    code = code.trimEnd() + '\n\nexport default router;\n';
  }

  return code;
}

async function processFile(file) {
  const before = await fsp.readFile(file, 'utf8');
  const after = transformCJS2ESM(before);
  if (after !== before) {
    await fsp.writeFile(file + '.bak', before, 'utf8');
    await fsp.writeFile(file, after, 'utf8');
    console.log('✔ converted:', path.relative(ROOT, file));
  }
}

async function main() {
  const files = TARGETS.flatMap(listJs);
  if (!files.length) {
    console.log('Nenhum arquivo .js encontrado nos alvos.');
    return;
  }
  for (const f of files) {
    await processFile(f);
  }
  console.log('\nDone. Backups criados como .bak quando houve alteração.');
}

main().catch(err => {
  console.error('fix-esm falhou:', err);
  process.exit(1);
});