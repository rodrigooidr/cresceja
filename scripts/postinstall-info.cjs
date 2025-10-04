console.log(`[root:postinstall] OK.
- Se o Docker acusar "npm ci ... Missing: X from lock file":
  1) Rode "npm install" DENTRO de cada pacote (ex.: backend/)
  2) Commite o package-lock.json
  3) Refaça "docker compose up --build"
`);
