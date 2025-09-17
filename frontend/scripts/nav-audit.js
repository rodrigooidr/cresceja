/* ADD-ONLY: verifica se o Sidebar possui links para as rotas do contrato */
const fs = require('fs');
const path = require('path');

const contractPath = path.resolve(__dirname, '../src/routes/contract.js');
const sidebarGuess = [
  path.resolve(__dirname, '../src/components/Sidebar.jsx'),
  path.resolve(__dirname, '../src/components/Sidebar.tsx'),
];
if (!fs.existsSync(contractPath)) {
  console.error('[nav-audit] routes/contract.js não encontrado.');
  process.exit(1);
}
const { ROUTE_CONTRACT } = require(contractPath);
const sidebarFile = sidebarGuess.find((f) => fs.existsSync(f));
if (!sidebarFile) {
  console.error('[nav-audit] Sidebar.jsx/tsx não encontrado em src/components.');
  process.exit(1);
}
const src = fs.readFileSync(sidebarFile, 'utf8');
const missing = ROUTE_CONTRACT
  .filter(({ path }) => !src.includes(`to="${path}"`) && !src.includes(`to='${path}'`))
  .map((r) => r.path);

if (missing.length) {
  console.error('[nav-audit] Links ausentes no Sidebar:', missing);
  process.exit(1);
} else {
  console.log('[nav-audit] OK — todos os caminhos do contrato possuem link no Sidebar.');
}
