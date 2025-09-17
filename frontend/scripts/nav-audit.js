
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

async function loadContract() {
  const contractUrl = pathToFileURL(path.resolve(__dirname, '../src/routes/contract.js'));
  const mod = await import(contractUrl.href);
  return mod.ROUTE_CONTRACT || [];
}

async function main() {
  const sidebarPath = path.resolve(__dirname, '../src/components/Sidebar.jsx');
  const src = fs.readFileSync(sidebarPath, 'utf8');
  const ROUTE_CONTRACT = await loadContract();

  const hasLinkFor = (routePath) => {
    if (src.includes(`to="${routePath}"`) || src.includes(`to='${routePath}'`)) return true;
    if (src.includes(`to: "${routePath}"`) || src.includes(`to: '${routePath}'`)) return true;
    return false;
  };

  const missing = ROUTE_CONTRACT.filter(({ path: routePath }) => !hasLinkFor(routePath)).map((r) => r.path);

  if (missing.length) {
    console.error('[nav-audit] Links ausentes no Sidebar:', missing);
    process.exit(1);
  } else {
    console.log('[nav-audit] OK — todos os caminhos do contrato possuem link no Sidebar.');
  }
}

main().catch((err) => {
  console.error('[nav-audit] Falha ao executar auditoria:', err);
  process.exit(1);
});

