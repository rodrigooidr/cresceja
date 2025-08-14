#!/usr/bin/env bash
set -euo pipefail
COMPOSE_FILE="${1:-infra/docker-compose.dev.yml}"
SERVICE="postgres"
FILES=(
  "infra/bootstrap_core.sql"
  "backend/sql/migrations/001_sprint1.sql"
  "backend/sql/migrations/002_sprint2.sql"
  "backend/sql/migrations/003_golive.sql"
  "backend/sql/social_posts_and_approvals.sql"
  "backend/sql/onboarding_schema.sql"
  "backend/sql/ai_usage_logs_init.sql"
  "backend/sql/indices.sql"
)
for f in "${FILES[@]}"; do
  if [[ ! -f "$f" ]]; then echo "SKIP (not found): $f"; continue; fi
  echo "Applying: $f"
  cat "$f" | docker compose -f "$COMPOSE_FILE" exec -T "$SERVICE" psql -U cresceja -d cresceja_db -v ON_ERROR_STOP=1
done
