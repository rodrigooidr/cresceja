console.log(`
[postinstall] Dica:
- Se no Docker aparecer "npm ci ... Missing: X from lock file",
  rode "npm install" no backend para sincronizar o package-lock.json
  e depois "docker compose up --build".
`);
