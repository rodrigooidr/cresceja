#!/usr/bin/env bash
set -euo pipefail
COMPOSE_FILE="${1:-infra/docker-compose.dev.yml}"
SERVICE="postgres"
FILES=(
  "infra/bootstrap_core.sql"
  "backend/db/migrations/001_sprint1.sql"
  "backend/db/migrations/002_sprint2.sql"
  "backend/db/migrations/003_golive.sql"
  "backend/db/social_posts_and_approvals.sql"
  "backend/db/onboarding_schema.sql"
  "backend/db/ai_usage_logs_init.sql"
  "backend/db/indices.sql"
)
for f in "${FILES[@]}"; do
  if [[ ! -f "$f" ]]; then echo "SKIP (not found): $f"; continue; fi
  echo "Applying: $f"
  cat "$f" | docker compose -f "$COMPOSE_FILE" exec -T "$SERVICE" psql -U cresceja -d cresceja_db -v ON_ERROR_STOP=1
done
