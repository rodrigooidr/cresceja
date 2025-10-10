

$BASE = "http://localhost:4000/api"
$ORG  = "8f181879-2f22-4831-967a-31c892f271bb"
$JWT  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjZGJkYzMzMy04N2Q2LTRkZGEtOTcyNi1hNzdmMjA2MDliNzUiLCJpZCI6ImNkYmRjMzMzLTg3ZDYtNGRkYS05NzI2LWE3N2YyMDYwOWI3NSIsImVtYWlsIjoicm9kcmlnb29pZHJAaG90bWFpbC5jb20iLCJuYW1lIjoiUm9kcmlnbyBPbGl2ZWlyYSIsIm9yZ19pZCI6IjhmMTgxODc5LTJmMjItNDgzMS05NjdhLTMxYzg5MmYyNzFiYiIsInJvbGUiOiJPcmdPd25lciIsInJvbGVzIjpbIk9yZ093bmVyIiwiU3VwZXJBZG1pbiJdLCJpYXQiOjE3NjAxMzg0NTAsImV4cCI6MTc2MDE4MTY1MH0.AeZLCK0s4yNjBNg1A0U-I2WwDa8fxSZVBsCvxfog7Qk"


# 1) token curto
$tok = Invoke-RestMethod -Method GET `
  -Uri ($BASE + "/integrations/providers/whatsapp_session/qr/token") `
  -Headers @{ "Authorization" = "Bearer $JWT"; "X-Org-Id" = $ORG }
"QR TOKEN: $(($tok | ConvertTo-Json -Compress))"

# 2) abre o stream (sem Authorization!)
$qr = Invoke-WebRequest -Method GET `
  -Uri ($BASE + "/integrations/providers/whatsapp_session/qr/stream") `
  -Headers @{ Accept = 'text/event-stream'; 'X-QR-Access-Token' = $tok.token }

"QR STREAM STATUS: $($qr.StatusCode)"
$qr.Headers.GetEnumerator() | ForEach-Object { "$($_.Name): $($_.Value)" }

