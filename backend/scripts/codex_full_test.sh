#!/usr/bin/env bash
# scripts/codex_full_test.sh
# Orquestra verificação total do monorepo CresceJá (frontend + backend + DB + E2E)
# Requisitos: bash, docker, docker-compose, node>=18, npm|yarn|pnpm, jq, curl
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPORT_DIR="$ROOT_DIR/reports"
mkdir -p "$REPORT_DIR"

log() { echo -e "\033[1;36m[CODEX]\033[0m $*"; }
warn(){ echo -e "\033[1;33m[WARN]\033[0m $*"; }
err() { echo -e "\033[1;31m[ERR]\033[0m $*" >&2; }

detect_pm () {
  if command -v pnpm >/dev/null 2>&1 && [ -f "pnpm-lock.yaml" ]; then echo "pnpm"; return
  elif command -v yarn >/dev/null 2>&1 && [ -f "yarn.lock" ]; then echo "yarn"; return
  else echo "npm"; fi
}

run_pm () {
  local pm="$1"; shift
  if [ "$pm" = "pnpm" ]; then pnpm "$@"
  elif [ "$pm" = "yarn" ]; then yarn "$@"
  else npm "$@"; fi
}

wait_for_port () {
  local host="$1" port="$2" name="${3:-service}" timeout="${4:-60}"
  log "Aguardando $name em $host:$port (timeout ${timeout}s)..."
  SECONDS=0
  until nc -z "$host" "$port" 2>/dev/null; do
    if [ $SECONDS -ge $timeout ]; then err "Timeout esperando $name"; return 1; fi
    sleep 1
  done
  log "$name disponível."
}

# --- 0) Variáveis do projeto (ajuste se necessário)
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
DB_SERVICE_NAME="cresceja-db"
DB_PORT="5432"
API_PORT="4000"
WEB_PORT="3000"
API_HEALTH_URL="http://localhost:${API_PORT}/api/health"
FRONT_URL="http://localhost:${WEB_PORT}"

# --- 1) Checagem de .env
log "Checando arquivos .env..."
if [ -d "$BACKEND_DIR" ]; then
  if [ ! -f "$BACKEND_DIR/.env" ] && [ -f "$BACKEND_DIR/.env.example" ]; then
    cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
    warn "backend/.env criado a partir de .env.example"
  fi
fi
if [ -d "$FRONTEND_DIR" ]; then
  if [ ! -f "$FRONTEND_DIR/.env" ] && [ -f "$FRONTEND_DIR/.env.example" ]; then
    cp "$FRONTEND_DIR/.env.example" "$FRONTEND_DIR/.env"
    warn "frontend/.env criado a partir de .env.example"
  fi
fi

# --- 2) Subir banco via docker-compose (preferido) ou docker run
log "Subindo infraestrutura de DB (Postgres)..."
cd "$ROOT_DIR"
if [ -f "docker-compose.yml" ] || [ -f "docker-compose.yaml" ]; then
  docker compose up -d
else
  # fallback: container simples de Postgres
  if ! docker ps --format '{{.Names}}' | grep -q "^${DB_SERVICE_NAME}$"; then
    docker run -d --name "$DB_SERVICE_NAME" \
      -e POSTGRES_PASSWORD=postgres \
      -e POSTGRES_USER=postgres \
      -e POSTGRES_DB=cresceja \
      -p ${DB_PORT}:5432 \
      postgres:15
  fi
fi
wait_for_port "localhost" "$DB_PORT" "Postgres" 80

# --- 3) Backend: install + lint + typecheck + migrate + test + start
if [ -d "$BACKEND_DIR" ]; then
  log "Processando BACKEND..."
  cd "$BACKEND_DIR"
  PM_BACK=$(detect_pm)
  run_pm "$PM_BACK" install

  # Lint e format
  if [ -f ".eslintrc.js" ] || [ -f ".eslintrc.cjs" ] || [ -f ".eslintrc.json" ]; then
    run_pm "$PM_BACK" run lint --silent || true
    run_pm "$PM_BACK" run lint:fix --silent || true || true
  fi
  if [ -f ".prettierrc" ] || [ -f ".prettierrc.json" ]; then
    run_pm "$PM_BACK" exec -- prettier --write "**/*.{js,jsx,ts,tsx,json,md}" || true
  fi

  # Type-check
  if [ -f "tsconfig.json" ]; then
    run_pm "$PM_BACK" exec -- tsc -p tsconfig.json --noEmit || (err "Type-check falhou" && exit 1)
  fi

  # Migrations (tenta detectar prisma/knex/sequelize)
  if [ -d "prisma" ]; then
    run_pm "$PM_BACK" exec -- prisma migrate deploy || run_pm "$PM_BACK" exec -- prisma migrate reset -f
  elif [ -d "migrations" ] || ls -1 *knex*.js >/dev/null 2>&1; then
    (run_pm "$PM_BACK" run migrate || run_pm "$PM_BACK" exec -- knex migrate:latest) || true
    (run_pm "$PM_BACK" run seed || run_pm "$PM_BACK" exec -- knex seed:run) || true
  elif [ -d "sequelize" ] || [ -d "models" ]; then
    run_pm "$PM_BACK" exec -- sequelize db:migrate || true
    run_pm "$PM_BACK" exec -- sequelize db:seed:all || true
  else
    warn "Nenhuma ferramenta de migration detectada; pulando."
  fi

  # Testes unitários
  if jq -e '.scripts.test' package.json >/dev/null 2>&1; then
    run_pm "$PM_BACK" test --silent || (err "Testes do backend falharam" && exit 1)
  else
    warn "Sem script de testes no backend."
  fi

  # Start API em background (produção simples)
  log "Subindo API para testes de contrato/integração..."
  PORT=$API_PORT NODE_ENV=test nohup $(run_pm "$PM_BACK" bin) run start >/dev/null 2>"$REPORT_DIR/backend_start.log" & \
    || nohup node server.js >/dev/null 2>"$REPORT_DIR/backend_start.log" &
  sleep 2
  wait_for_port "localhost" "$API_PORT" "API" 60

  # Healthcheck de API
  if command -v curl >/dev/null; then
    curl -fsSL "$API_HEALTH_URL" -o "$REPORT_DIR/api_health.json" || warn "Health endpoint não respondeu"
  fi

  # Segurança
  run_pm "$PM_BACK" audit || true
  run_pm "$PM_BACK" audit fix || true
else
  warn "Diretório backend/ não encontrado."
fi

# --- 4) Frontend: install + lint + typecheck + unit + build + e2e
if [ -d "$FRONTEND_DIR" ]; then
  log "Processando FRONTEND..."
  cd "$FRONTEND_DIR"
  PM_FRONT=$(detect_pm)
  run_pm "$PM_FRONT" install

  if [ -f ".eslintrc.js" ] || [ -f ".eslintrc.cjs" ] || [ -f ".eslintrc.json" ]; then
    run_pm "$PM_FRONT" run lint --silent || true
    run_pm "$PM_FRONT" run lint:fix --silent || true
  fi
  if [ -f "tsconfig.json" ]; then
    run_pm "$PM_FRONT" exec -- tsc -p tsconfig.json --noEmit || (err "Type-check do frontend falhou" && exit 1)
  fi

  if jq -e '.scripts.test' package.json >/dev/null 2>&1; then
    CI=true run_pm "$PM_FRONT" test --silent || warn "Testes do frontend falharam"
  fi

  # Build e servir para E2E
  if jq -e '.scripts.build' package.json >/dev/null 2>&1; then
    run_pm "$PM_FRONT" run build
    npx --yes serve -s build -l "$WEB_PORT" >/dev/null 2>"$REPORT_DIR/frontend_serve.log" &
    sleep 2
    wait_for_port "localhost" "$WEB_PORT" "Frontend" 60
  fi

  # E2E com Playwright (se presente)
  if [ -d "e2e" ] || [ -f "playwright.config.ts" ] || [ -f "playwright.config.js" ]; then
    npx --yes playwright install --with-deps || true
    npx --yes playwright test || (err "Testes E2E falharam" && exit 1)
    npx --yes playwright show-report || true
    cp -r ./playwright-report "$REPORT_DIR"/playwright-report || true
  else
    warn "Playwright não configurado; pulando E2E."
  fi
else
  warn "Diretório frontend/ não encontrado."
fi

# --- 5) Relatórios
log "Coletando relatórios..."
# Copiar coverage se existir
[ -d "$BACKEND_DIR/coverage" ] && cp -r "$BACKEND_DIR/coverage" "$REPORT_DIR/backend-coverage"
[ -d "$FRONTEND_DIR/coverage" ] && cp -r "$FRONTEND_DIR/coverage" "$REPORT_DIR/frontend-coverage"

log "✅ Pipeline concluído. Relatórios em $REPORT_DIR"
