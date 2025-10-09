# ===== Config =====
$BASE   = "http://localhost:4000"
$TOKEN  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjZGJkYzMzMy04N2Q2LTRkZGEtOTcyNi1hNzdmMjA2MDliNzUiLCJpZCI6ImNkYmRjMzMzLTg3ZDYtNGRkYS05NzI2LWE3N2YyMDYwOWI3NSIsImVtYWlsIjoicm9kcmlnb29pZHJAaG90bWFpbC5jb20iLCJuYW1lIjoiUm9kcmlnbyBPbGl2ZWlyYSIsIm9yZ19pZCI6IjhmMTgxODc5LTJmMjItNDgzMS05NjdhLTMxYzg5MmYyNzFiYiIsInJvbGUiOiJPcmdPd25lciIsInJvbGVzIjpbIk9yZ093bmVyIiwiU3VwZXJBZG1pbiJdLCJpYXQiOjE3NjAwMzk3OTMsImV4cCI6MTc2MDA4Mjk5M30.AzQd7JI0hdQcPNOaQMqj0joUasIffbs1_jvqNEgrne0"
$ORG    = "8f181879-2f22-4831-967a-31c892f271bb"  # seu Org ID

$Headers = @{
  "Authorization" = "Bearer $TOKEN"
  "X-Org-Id"      = $ORG
}

# ===== 1) Conectar (iniciar sessão Baileys / gerar QR) =====
irm -Method POST -Uri "$BASE/api/integrations/providers/whatsapp_session/connect" `
    -Headers $Headers -ContentType "application/json" -Body "{}" | ConvertTo-Json -Depth 5

# ===== 2) Status =====
irm -Method GET -Uri "$BASE/api/integrations/providers/whatsapp_session/status" `
    -Headers $Headers | ConvertTo-Json -Depth 5

# ===== 3) QR (fallback HTTP) -> salvar PNG =====
$qr = irm -Method GET -Uri "$BASE/api/integrations/providers/whatsapp_session/qr" -Headers $Headers
$dataUrl = $qr.dataUrl
if (-not $dataUrl) { throw "Sem QR disponível ainda (tente novamente em 1-2s)." }

# salvar o QR
if ($dataUrl -notmatch '^data:(?<mime>[^;]+)(;charset=[^;]+)?;base64,(?<b64>.+)$') { throw "Data URL inválida" }
$bytes = [Convert]::FromBase64String($Matches['b64'])
$path = Join-Path $PSScriptRoot "whatsapp_qr.png"
[IO.File]::WriteAllBytes($path, $bytes) | Out-Null
"QR salvo em: $path"

# ===== 4) (Opcional) Desconectar sessão =====
irm -Method POST -Uri "$BASE/api/integrations/providers/whatsapp_session/disconnect" `
    -Headers $Headers -ContentType "application/json" -Body "{}" | ConvertTo-Json -Depth 5