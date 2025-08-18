# run_from_scratch.ps1 (corrigido)
# Reinicia ambiente DEV do CresceJá (Windows + Docker + Node)
$ErrorActionPreference = "Stop"

# === Ajustes de caminhos ===
$ROOT = "C:\Projetos App\cresceja"
$BACK = Join-Path $ROOT "backend"
$FRONT = Join-Path $ROOT "frontend"
$MIG = Join-Path $BACK "db\migrations\20250815_billing.sql"

# === 0) Utilitários ===
function Stop-Port {
  param([int]$Port)
  try {
    Import-Module NetTCPIP -ErrorAction SilentlyContinue | Out-Null
    $pids = (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue).OwningProcess | Select-Object -Unique
    foreach ($pid in $pids) { if ($pid) { Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue } }
  } catch { }
}

function Safe-WriteFile {
  param([string]$Path, [string]$Content)
  if (-not (Test-Path $Path)) {
    New-Item -Force -ItemType File -Path $Path | Out-Null
    Set-Content -Path $Path -Value $Content -Encoding UTF8
    Write-Host "✓ criado: $Path"
  } else {
    Write-Host "• já existe: $Path (mantido)"
  }
}

# === 1) Parar serviços/portas e containers conflitantes ===
Write-Host "`n==> Limpando portas e containers antigos..."
Stop-Port 4000
try {
  docker stop cresceja-backend 2>$null | Out-Null
  docker rm   cresceja-backend 2>$null | Out-Null
} catch { }

# === 2) Subir Postgres (Docker) ===
Write-Host "`n==> Subindo Postgres (Docker) ..."
docker inspect cresceja-postgres 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  docker run -d --name cresceja-postgres -p 5432:5432 `
    -e POSTGRES_PASSWORD=postgres -v cresceja_pgdata:/var/lib/postgresql/data `
    postgres:16-alpine | Out-Null
} else {
  docker start cresceja-postgres | Out-Null
}

# Espera Postgres aceitar conexões (pg_isready)
Write-Host "Aguardando Postgres..."
for ($i=0; $i -lt 20; $i++) {
  docker exec cresceja-postgres pg_isready -U postgres 1>$null 2>$null
  if ($LASTEXITCODE -eq 0) { break }
  Start-Sleep -Seconds 1
}

# === 3) Criar DB se não existir e rodar migration ===
Write-Host "`n==> Provisionando banco cresceja_db..."


# Existe DB cresceja_db?
$dbExists = (docker exec -i cresceja-postgres psql -U postgres -Atc "SELECT 1 FROM pg_database WHERE datname='cresceja_db';").Trim()
if (-not $dbExists) {
  docker exec -i cresceja-postgres psql -U postgres -c "CREATE DATABASE cresceja_db OWNER cresceja;" | Out-Null
  Write-Host "✓ database 'cresceja_db' criado"
} else {
  Write-Host "• database 'cresceja_db' já existe"
}

# Rodar migration (se existir)
if (Test-Path $MIG) {
  Write-Host "Aplicando migration: $MIG"
  type "$MIG" | docker exec -i cresceja-postgres psql -U postgres -d cresceja_db | Out-Null
  Write-Host "✓ migration aplicada"
} else {
  Write-Warning "Migration não encontrada em $MIG — pulando."
}

# === 4) Backend: .env + db config ===
Write-Host "`n==> Preparando backend (.env e config/db.js)..."
$BACK_ENV = @"
PORT=4000
NODE_ENV=development
DATABASE_URL=postgres://cresceja:cresceja123@localhost:5432/cresceja_db
JWT_SECRET=CresceJa_jwt123
CORS_ORIGINS=http://localhost:3000
BILLING_DEV_MODE=true
"@
Safe-WriteFile -Path (Join-Path $BACK ".env") -Content $BACK_ENV

$DB_JS = @"
// backend/config/db.js
import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
export async function query(text, params) { return pool.query(text, params); }
"@
if (-not (Test-Path (Join-Path $BACK "config\db.js"))) {
  New-Item -ItemType Directory -Force -Path (Join-Path $BACK "config") | Out-Null
  Safe-WriteFile -Path (Join-Path $BACK "config\db.js") -Content $DB_JS
}

# === 5) Frontend: .env (usar proxy do CRA) ===
Write-Host "`n==> Preparando frontend (.env)..."
$FRONT_ENV = @"
# deixe vazio para usar o proxy do CRA (package.json: ""proxy"": ""http://localhost:4000"")
REACT_APP_API_BASE_URL=
"@
Safe-WriteFile -Path (Join-Path $FRONT ".env") -Content $FRONT_ENV

# === 6) Instalar deps ===
Write-Host "`n==> Instalando dependências..."
Push-Location $BACK; npm i | Out-Null; npm i -D pino-pretty | Out-Null; Pop-Location
Push-Location $FRONT; npm i | Out-Null; Pop-Location

# === 7) Start backend e frontend em janelas separadas ===
Write-Host "`n==> Iniciando backend e frontend..."
Start-Process powershell -ArgumentList "cd `"$BACK`"; npm run dev"
Start-Process powershell -ArgumentList "cd `"$FRONT`"; npm start"

Write-Host "`n===== READY! ====="
Write-Host "Backend:  http://localhost:4000  (GET /api/public/plans)"
Write-Host "Frontend: http://localhost:3000"
Write-Host "Após registrar um usuário, promova-o a admin via SQL:"
Write-Host "docker exec -it cresceja-postgres psql -U postgres -d cresceja_db"
Write-Host "UPDATE users SET role='admin' WHERE email='rodrigooidr@hotmail.com';"
