// Normaliza entradas git no package-lock.json para https:// (evita SSH)
// e não falha no Windows/CI.
const fs = require('fs');
const path = require('path');

try {
  const lockPath = path.join(process.cwd(), 'package-lock.json');
  if (!fs.existsSync(lockPath)) {
    console.log('[preinstall-fix] package-lock.json não encontrado — ok');
    process.exit(0);
  }
  const original = fs.readFileSync(lockPath, 'utf8');
  const patched = original
    .replace(/ssh:\/\/git@github.com\//g, 'https://github.com/')
    .replace(/git@github.com:/g, 'https://github.com/')
    .replace(/git:\/\//g, 'https://');

  if (patched !== original) {
    fs.writeFileSync(lockPath, patched);
    console.log('[preinstall-fix] package-lock.json normalizado para HTTPS');
  } else {
    console.log('[preinstall-fix] nada para alterar');
  }
} catch (e) {
  console.warn('[preinstall-fix] ignorando erro:', e?.message || e);
  // Nunca quebrar instalação por causa desse passo
  process.exit(0);
}
