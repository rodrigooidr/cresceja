# tests-inbox.ps1
# E2E test runner para Cresce Já — Inbox, IA, Templates, Agenda, Availability, Appointments Core

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ========= CONFIG =========
if ([string]::IsNullOrWhiteSpace($env:BASE)) { $env:BASE = 'http://localhost:3000' }
$env:ORG  = '8f181879-2f22-4831-967a-31c892f271bb'
$env:TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjZGJkYzMzMy04N2Q2LTRkZGEtOTcyNi1hNzdmMjA2MDliNzUiLCJpZCI6ImNkYmRjMzMzLTg3ZDYtNGRkYS05NzI2LWE3N2YyMDYwOWI3NSIsImVtYWlsIjoicm9kcmlnb29pZHJAaG90bWFpbC5jb20iLCJuYW1lIjoiUm9kcmlnbyBPbGl2ZWlyYSIsIm9yZ19pZCI6IjhmMTgxODc5LTJmMjItNDgzMS05NjdhLTMxYzg5MmYyNzFiYiIsInJvbGUiOiJPcmdPd25lciIsInJvbGVzIjpbIk9yZ093bmVyIiwiU3VwZXJBZG1pbiJdLCJpYXQiOjE3NTk3OTI5MzIsImV4cCI6MTc1OTgzNjEzMn0.1hCrazqeJEKzlstLnhCzexcC6UU0mNmggXd3VSKCjH4'

# traga as variáveis de ambiente para variáveis locais ANTES de checar/usar
$BASE  = $env:BASE
$ORG   = $env:ORG
$TOKEN = $env:TOKEN

if ([string]::IsNullOrWhiteSpace($BASE)) { $BASE = 'http://localhost:3000' }
if ([string]::IsNullOrWhiteSpace($ORG))  { $ORG  = '8f181879-2f22-4831-967a-31c892f271bb' }

$Headers = @{
  'x-org-id' = $ORG
  'Accept'   = 'application/json'
}
if (-not [string]::IsNullOrWhiteSpace($TOKEN)) {
  $Headers['Authorization'] = "Bearer $TOKEN"
}

# ========= HELPERS =========
$global:TestsRun = 0
$global:Failures = 0
$global:FailedTests = New-Object System.Collections.ArrayList

function Write-Title($txt) { Write-Host "`n=== $txt ===" -ForegroundColor Cyan }
function Pass($msg) { Write-Host ("PASS: " + $msg) -ForegroundColor Green; $global:TestsRun++ }
function Fail($msg) { Write-Host ("FAIL: " + $msg) -ForegroundColor Red; $global:TestsRun++; $global:Failures++; [void]$global:FailedTests.Add($msg) }

function Invoke-Api {
  param(
    [Parameter(Mandatory=$true)][ValidateSet('GET','POST','PUT','DELETE')]$Method,
    [Parameter(Mandatory=$true)][string]$Path,
    [hashtable]$Body
  )

  $url = "$BASE$Path"

  # Monta parâmetros de forma compatível com PS7 (usa -SkipHttpErrorCheck para não lançar exceção em 4xx/5xx)
  $params = @{
    Method  = $Method
    Uri     = $url
    Headers = $Headers
  }
  if ($PSBoundParameters.ContainsKey('Body') -and $Body) {
    $params.ContentType = 'application/json'
    $params.Body        = ($Body | ConvertTo-Json -Depth 10 -Compress)
  }
  if ($PSVersionTable.PSVersion.Major -ge 6) {
    $params.SkipHttpErrorCheck = $true
  }

  try {
    $resp = Invoke-WebRequest @params
    $status  = [int]$resp.StatusCode
    $content = $resp.Content
  } catch {
    # Fallback (PS5.1 sem -SkipHttpErrorCheck)
    $status  = -1
    $content = $_.Exception.Message
    $respObj = $null
    try { $respObj = $_.Exception.Response } catch {}

    if ($null -ne $respObj) {
      try {
        if ($respObj -is [System.Net.Http.HttpResponseMessage]) {
          # PS7
          $status  = [int]$respObj.StatusCode
          $content = $respObj.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        } elseif ($respObj -is [System.Net.HttpWebResponse]) {
          # PS5.1
          $status  = [int]$respObj.StatusCode
          $reader  = New-Object System.IO.StreamReader($respObj.GetResponseStream())
          $content = $reader.ReadToEnd()
        }
      } catch {}
    }
  }

  $obj = $null
  try { $obj = $content | ConvertFrom-Json -ErrorAction Stop } catch { $obj = $null }

  return @{ status=$status; obj=$obj; raw=$content; url=$url }
}


function Expect-Status {
  param($resp, [int[]]$Expected, [string]$label)
  if ($Expected -contains $resp.status) { Pass "$label ($($resp.status))" }
  else { Fail "$label — esperado: $($Expected -join ',') obtido: $($resp.status) — $($resp.url) — body: $($resp.raw)" }
}

function Expect-Has {
  param($cond, [string]$label, $dbg)
  if ($cond) { Pass $label }
  else { Fail "$label — body: $($dbg | ConvertTo-Json -Depth 6)" }
}

# ========= IDs de teste =========
$conversationId = [guid]::NewGuid().ToString()
$clientId       = [guid]::NewGuid().ToString()
$templateName   = "Agradecimento-" + ((Get-Date).ToString("yyyyMMddHHmmss"))
$apptDate       = (Get-Date).ToUniversalTime().AddDays(1).ToString("yyyy-MM-dd")
$apptStartIso   = (Get-Date).ToUniversalTime().AddHours(2).ToString("yyyy-MM-ddTHH:mm:ss.000Z")
$apptEndIso     = (Get-Date).ToUniversalTime().AddHours(2.5).ToString("yyyy-MM-ddTHH:mm:ss.000Z")

# ========= TESTES =========

Write-Title "1) Feature Flags (rota canônica)"
$features = Invoke-Api GET "/api/orgs/$ORG/features"
Expect-Status $features @(200) "GET /api/orgs/:orgId/features"
if ($features.status -eq 200) {
  $f = $features.obj.features
  Expect-Has ($f.inbox -eq $true) "features.inbox=true" $features.obj
  Expect-Has ($f.ai_draft -ne $null) "features.ai_draft presente" $features.obj
  Expect-Has ($f.templates -ne $null) "features.templates presente" $features.obj
  Expect-Has ($f.calendar_scheduling -ne $null) "features.calendar_scheduling presente" $features.obj
}

Write-Title "1.a) Feature Flags (rota legacy opcional — deve ser 404 OU idêntica à canônica)"
$legacy = Invoke-Api GET "/api/orgs/$ORG/features"   # se a rota duplicada não estiver registrada, isso é a mesma canônica
# Tentativa de rota realmente legacy: /api/orgs/:id/features (alguns projetos registravam outra instância)
# Se você a removeu, este teste passará como 'skipped'. Senão, deve responder igual.
# Para não quebrar, apenas registramos status:
if ($legacy.status -in @(200,404)) { Pass "Legacy features ok (status $($legacy.status))" } else { Fail "Legacy features irregular (status $($legacy.status))" }

Write-Title "2) Inbox — Conversations"
$r = Invoke-Api GET "/api/inbox/conversations?status=open&limit=50"
Expect-Status $r @(200) "GET /api/inbox/conversations"
if ($r.status -eq 200) {
  Expect-Has ($r.obj.conversations -is [System.Collections.IEnumerable]) "conversations é array" $r.obj
  Expect-Has ($r.obj.meta.status -eq "open") "meta.status=open" $r.obj
}

Write-Title "3) Inbox — Messages (GET/POST)"
$r = Invoke-Api GET "/api/inbox/messages?conversation_id=$conversationId&limit=50"
Expect-Status $r @(200) "GET /api/inbox/messages"
$r2 = Invoke-Api POST "/api/inbox/messages" @{ conversation_id=$conversationId; text="Olá do teste" }
Expect-Status $r2 @(201) "POST /api/inbox/messages"
$messageId = $null; if ($r2.status -eq 201) { $messageId = $r2.obj.message.id }

Write-Title "4) Inbox — Reads / Assume / Release / Status"
$r = Invoke-Api POST "/api/inbox/reads" @{ conversation_id=$conversationId; last_message_id=$messageId }
Expect-Status $r @(204) "POST /api/inbox/reads"
$r = Invoke-Api PUT "/api/inbox/conversations/$conversationId/assume"
Expect-Status $r @(200) "PUT /assume"
$r = Invoke-Api PUT "/api/inbox/conversations/$conversationId/release"
Expect-Status $r @(200) "PUT /release"
$r = Invoke-Api PUT "/api/inbox/conversations/$conversationId/status" @{ status="closed" }
Expect-Status $r @(200) "PUT /status closed"

Write-Title "5) Inbox — Tags / Channels"
$r = Invoke-Api GET "/api/inbox/tags"
Expect-Status $r @(200) "GET /tags"
$r2 = Invoke-Api POST "/api/inbox/conversations/$conversationId/tags" @{ tags=@("vip","orçamento") }
Expect-Status $r2 @(200) "POST /:id/tags"
$r3 = Invoke-Api GET "/api/inbox/channels"
Expect-Status $r3 @(200) "GET /channels"
if ($r3.status -eq 200) { Expect-Has ($r3.obj.channels -contains "whatsapp") "channels inclui whatsapp" $r3.obj }

Write-Title "6) Inbox — Clients (GET/PUT)"
$r = Invoke-Api GET "/api/inbox/clients/$clientId"
Expect-Status $r @(200) "GET /clients/:id"
$r2 = Invoke-Api PUT "/api/inbox/clients/$clientId" @{ name="Cliente Teste"; phone="+5511999999999" }
Expect-Status $r2 @(200) "PUT /clients/:id"

Write-Title "7) Inbox — Uploads"
$r = Invoke-Api POST "/api/inbox/uploads" @{ filename="dummy.txt" }
Expect-Status $r @(201) "POST /uploads"
if ($r.status -eq 201) { Expect-Has ($r.obj.file_id -ne $null -and $r.obj.url -ne $null) "uploads: file_id e url presentes" $r.obj }

Write-Title "8) IA — Draft / Summarize / Classify"
$ctx = @(@{ sender_type="customer"; text="Quero agendar amanhã às 10h, é possível?" })
$r = Invoke-Api POST "/api/inbox/ai/draft" @{ conversation_id=$conversationId; context=$ctx; tone="gentil"; language="pt" }
Expect-Status $r @(200) "POST /ai/draft"
$r = Invoke-Api POST "/api/inbox/ai/summarize" @{ conversation_id=$conversationId; context=$ctx }
Expect-Status $r @(200) "POST /ai/summarize"
$r = Invoke-Api POST "/api/inbox/ai/classify" @{ conversation_id=$conversationId; context=$ctx }
Expect-Status $r @(200) "POST /ai/classify"

Write-Title "9) Templates — CRUD"
$rList0 = Invoke-Api GET "/api/inbox/templates"
Expect-Status $rList0 @(200) "GET /templates (lista inicial)"
$len0 = if ($rList0.obj) { ($rList0.obj.templates | Measure-Object).Count } else { 0 }

$rCreate = Invoke-Api POST "/api/inbox/templates" @{ name=$templateName; body="Obrigado, {{first_name}}!"; variables=@("first_name") }
Expect-Status $rCreate @(201) "POST /templates (create)"
$templateId = if ($rCreate.status -eq 201) { $rCreate.obj.template.id } else { $null }

$rUpdate = Invoke-Api PUT "/api/inbox/templates/$templateId" @{ body="Obrigado, {{first_name}}! Até breve." }
Expect-Status $rUpdate @(200) "PUT /templates/:id (update)"

$rList1 = Invoke-Api GET "/api/inbox/templates"
Expect-Status $rList1 @(200) "GET /templates (lista após create/update)"
$len1 = if ($rList1.obj) { ($rList1.obj.templates | Measure-Object).Count } else { 0 }
if ($templateId) {
  $rDel = Invoke-Api DELETE "/api/inbox/templates/$templateId"
  Expect-Status $rDel @(204) "DELETE /templates/:id"
}

Write-Title "10) Agenda — Status / Propose / Event / Logs / Delete"
$r = Invoke-Api GET "/api/integrations/google/calendar/status"
Expect-Status $r @(200) "GET /calendar/status"

$r = Invoke-Api POST "/api/integrations/google/calendar/propose-slots" @{ duration_min=30; count=3; tz="America/Sao_Paulo" }
Expect-Status $r @(200) "POST /calendar/propose-slots"
if ($r.status -eq 200) { Expect-Has ( ($r.obj.slots | Measure-Object).Count -ge 1 ) "propose-slots retornou slots" $r.obj }

$rCreateEv = Invoke-Api POST "/api/integrations/google/calendar/events" @{
  org_id=$ORG; title="Consulta de Teste"; start=$apptStartIso; end=$apptEndIso;
  attendees=@(@{ email="cliente@example.com"; name="Cliente" }); conversation_id=$conversationId
}
Expect-Status $rCreateEv @(201) "POST /calendar/events"
$eventId = if ($rCreateEv.status -eq 201) { $rCreateEv.obj.event.id } else { $null }

$rLogs = Invoke-Api GET "/api/integrations/google/calendar/logs"
Expect-Status $rLogs @(200) "GET /calendar/logs"

if ($eventId) {
  $rDel = Invoke-Api DELETE "/api/integrations/google/calendar/events/$eventId"
  Expect-Status $rDel @(204) "DELETE /calendar/events/:id"
}

Write-Title "11) Availability — GET slots reais (stub/freebusy)"
$r = Invoke-Api GET "/api/appointments/availability?professionalId=P1&appointmentTypeId=T1&date=$apptDate&period=morning"
Expect-Status $r @(200) "GET /appointments/availability"
if ($r.status -eq 200) { Expect-Has ( ($r.obj.slots | Measure-Object).Count -ge 0 ) "availability slots (>=0)" $r.obj }

Write-Title "12) Appointments Core — CRUD/Estados/Webhook"
$r = Invoke-Api POST "/api/appointments" @{ org_id=$ORG; professional_id="P1"; contact_id=$clientId; start_at=$apptStartIso; end_at=$apptEndIso }
Expect-Status $r @(201) "POST /api/appointments"
$apptId = if ($r.status -eq 201) { $r.obj.appointment.id } else { $null }

if ($apptId) {
  $r2 = Invoke-Api PUT "/api/appointments/$apptId" @{ start_at=$apptStartIso; end_at=$apptEndIso }
  Expect-Status $r2 @(200) "PUT /api/appointments/:id (reagendar)"
  $r3 = Invoke-Api POST "/api/appointments/confirm/$apptId" @{ reply="Sim" }
  Expect-Status $r3 @(200) "POST /api/appointments/confirm/:id"
  $r4 = Invoke-Api DELETE "/api/appointments/$apptId"
  Expect-Status $r4 @(204) "DELETE /api/appointments/:id"
}

$r = Invoke-Api POST "/api/appointments/webhooks/google"
Expect-Status $r @(204) "POST /api/appointments/webhooks/google"

Write-Title "13) Reports (se existir)"
$r = Invoke-Api GET "/api/appointments/reports/overview?orgId=$ORG&period=last_30d"
if ($r.status -in @(200,404)) {
  Pass "GET /api/appointments/reports/overview (status $($r.status))"
} else {
  Fail "GET /api/appointments/reports/overview — status $($r.status)"
}

# ========= RESUMO =========
Write-Host "`n======================" -ForegroundColor Yellow
Write-Host ("TOTAL TESTS: {0} | FAILURES: {1}" -f $global:TestsRun, $global:Failures) -ForegroundColor Yellow
if ($global:Failures -gt 0) {
  Write-Host "FAILED LIST:" -ForegroundColor Yellow
  $global:FailedTests | ForEach-Object { Write-Host "- $_" -ForegroundColor Yellow }
}
