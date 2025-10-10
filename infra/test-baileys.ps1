$BASE = "http://localhost:3000/api"
$ORG  = "8f181879-2f22-4831-967a-31c892f271bb"
$TOKEN= "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjZGJkYzMzMy04N2Q2LTRkZGEtOTcyNi1hNzdmMjA2MDliNzUiLCJpZCI6ImNkYmRjMzMzLTg3ZDYtNGRkYS05NzI2LWE3N2YyMDYwOWI3NSIsImVtYWlsIjoicm9kcmlnb29pZHJAaG90bWFpbC5jb20iLCJuYW1lIjoiUm9kcmlnbyBPbGl2ZWlyYSIsIm9yZ19pZCI6IjhmMTgxODc5LTJmMjItNDgzMS05NjdhLTMxYzg5MmYyNzFiYiIsInJvbGUiOiJPcmdPd25lciIsInJvbGVzIjpbIk9yZ093bmVyIiwiU3VwZXJBZG1pbiJdLCJpYXQiOjE3NjAxMDA1NzgsImV4cCI6MTc2MDE0Mzc3OH0.D-WYaXSNsAj27tBVtSjcnrcuzHSPJDhFcuin0OEUlOk"

$Headers = @{
  "Authorization" = "Bearer $TOKEN"
  "X-Org-Id"      = $ORG
}

# 1) CONNECT (grava status=connecting e meta.session_state=pending_qr)
$resp = Invoke-RestMethod -Method POST -Uri "$BASE/integrations/providers/whatsapp_session/connect" -Headers $Headers -Body "{}" -ContentType "application/json"
"CONNECT OK: $(($resp | ConvertTo-Json -Compress))"

# 2) TOKEN (agora deve retornar 200 com { token, expires_in })
$tok = Invoke-RestMethod -Method GET -Uri "$BASE/integrations/providers/whatsapp_session/qr/token" -Headers $Headers
"QR TOKEN: $(($tok | ConvertTo-Json -Compress))"

# 3) STREAM via header (SSE) usando o token curto
$h2 = @{ "X-QR-Access-Token" = $tok.token }
$qr = Invoke-WebRequest -Method GET -Uri "$BASE/integrations/providers/whatsapp_session/qr/stream" -Headers $h2
"QR STREAM HEADERS:"
$qr.Headers.GetEnumerator() | ForEach-Object { "$($_.Name): $($_.Value)" }

# 4) (Depois de ler 'type: qr' no stream e escanear o QR no WhatsApp)
$mc = Invoke-RestMethod -Method POST -Uri "$BASE/integrations/providers/whatsapp_session/mark-connected" -Headers $Headers -Body "{}" -ContentType "application/json"
"MARK-CONNECTED OK: $(($mc | ConvertTo-Json -Compress))"
