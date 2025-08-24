
Param(
  [string]$ComposeFile = ".\infra\docker-compose.dev.yml",
  [string]$Service = "postgres"
)
$ErrorActionPreference = "Stop"
$files = @(
  ".\infra\bootstrap_core.sql",
  ".\backend\db\migrations\001_sprint1.sql",
  ".\backend\db\migrations\002_sprint2.sql",
  ".\backend\db\migrations\003_golive.sql",
  ".\backend\db\social_posts_and_approvals.sql",
  ".\backend\db\onboarding_schema.sql",
  ".\backend\db\ai_usage_logs_init.sql",
  ".\backend\db\indices.sql"
)
foreach ($f in $files) {
  if (!(Test-Path $f)) { Write-Host "SKIP (not found): $f"; continue }
  Write-Host "Applying: $f"
  Get-Content $f | docker compose -f $ComposeFile exec -T $Service psql -U cresceja -d cresceja_db -v ON_ERROR_STOP=1
}
