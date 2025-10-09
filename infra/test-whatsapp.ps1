# ================================
# Configurações
# ================================
$BASE   = "http://localhost:4000"           # ou sua URL pública (https://xxxx.ngrok.io)
$ORG_ID = "8f181879-2f22-4831-967a-31c892f271bb"       # obrigatório para rotas com org context
$EMAIL  = "rodrigooidr@hotmail.com"                     # usado no dev-login (se habilitado)
$ROLE   = "OrgOwner"                        # precisa ser Owner para passar nos middlewares
$TOKEN  = ""                                # deixe vazio para tentar dev-login automático

# Opcional: envio via Cloud API (Meta/Twilio)
$ENABLE_CLOUD_SEND = $true
$TO_NUMBER = "+5541999158303"               # destino do teste (apenas se ENABLE_CLOUD_SEND = $true)
$TEST_TEXT = "Teste CresceJá ✅ via Cloud API"


# Onde salvar o QR:
$QR_PATH = "$PSScriptRoot\whatsapp_qr.png"

# ================================
# Helpers
# ================================
function Read-Password([string]$Prompt="Senha") {
  $sec = Read-Host -AsSecureString -Prompt $Prompt
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
  try { [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}

function Invoke-Api {
  param(
    [Parameter(Mandatory)] [string] $Method,
    [Parameter(Mandatory)] [string] $Url,
    [Hashtable] $Headers,
    [Object] $Body
  )
  try {
    if ($Body) {
      return Invoke-RestMethod -Method $Method -Uri $Url -Headers $Headers -ContentType "application/json" -Body ($Body | ConvertTo-Json -Depth 10)
    } else {
      return Invoke-RestMethod -Method $Method -Uri $Url -Headers $Headers
    }
  } catch {
    Write-Host "Erro em $Method $Url" -ForegroundColor Red
    if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
      Write-Host $_.ErrorDetails.Message -ForegroundColor Yellow
    } elseif ($_.Exception.Response -and $_.Exception.Response.Content) {
      $text = $_.Exception.Response.Content.ReadAsStringAsync().Result
      if ($text) { Write-Host $text -ForegroundColor Yellow }
    } else {
      Write-Host $_ -ForegroundColor Yellow
    }
    throw
  }
}

function Decode-DataUrlToFile {
  param(
    [Parameter(Mandatory)] [string] $DataUrl,
    [Parameter(Mandatory)] [string] $OutPath
  )
  if ($DataUrl -notmatch '^data:(?<mime>[^;]+)(;charset=[^;]+)?;base64,(?<b64>.+)$') {
    throw "Formato de data URL inválido."
  }
  $bytes = [Convert]::FromBase64String($Matches['b64'])
  [IO.File]::WriteAllBytes($OutPath, $bytes) | Out-Null
  return $OutPath
}

# ================================
# 0) Health (/health)
# ================================
Write-Host "-> Healthcheck" -ForegroundColor Cyan
Invoke-RestMethod "$BASE/health"

# ================================
# 1) Token ou Login
# ================================
if (-not $ORG_ID -or $ORG_ID.Trim().Length -eq 0) {
  $ORG_ID = Read-Host "Org ID (ex: 8f181879-2f22-4831-967a-31c892f271bb)"
}
if (-not $TOKEN -or $TOKEN.Trim().Length -eq 0) {
  $TOKEN = Read-Host "Cole o Bearer TOKEN (só o JWT, sem 'Bearer'). Deixe em branco p/ login"
}

if (-not $TOKEN -or $TOKEN.Trim().Length -eq 0) {
  $EMAIL = Read-Host "E-mail para login"
  $PASSWORD = Read-Password "Senha"

  Write-Host "-> Login /api/auth/login" -ForegroundColor Cyan
  $loginRes = Invoke-Api -Method POST -Url "$BASE/api/auth/login" -Body @{ email = $EMAIL; password = $PASSWORD }
  if ($loginRes.token) { $TOKEN = $loginRes.token } else { throw "Login sem token. Abortei." }
}

$Headers = @{ "Authorization" = "Bearer $TOKEN"; "X-Org-Id" = $ORG_ID }

# ================================
# 2) Iniciar sessão Baileys (gera QR)
# ================================
Write-Host "-> Iniciando sessão WhatsApp (Baileys)..." -ForegroundColor Cyan
Invoke-Api -Method POST -Url "$BASE/api/integrations/whatsapp/session/start" -Headers $Headers -Body @{}

# ================================
# 3) Poll status + baixar QR via fallback HTTP
# ================================
Write-Host "-> Aguardando QR..." -ForegroundColor Cyan
$qrSaved = $false
for ($i=0; $i -lt 15; $i++) {
  Start-Sleep -Seconds 1
  $status = Invoke-Api -Method GET -Url "$BASE/api/integrations/whatsapp/session/status" -Headers $Headers
  Write-Host ("Status: {0} | hasQR={1}" -f $status.status, $status.hasQR)
  if ($status.hasQR) {
    $qrRes = Invoke-Api -Method GET -Url "$BASE/api/integrations/whatsapp/session/qr" -Headers $Headers
    $path = Decode-DataUrlToFile -DataUrl $qrRes.dataUrl -OutPath $QR_PATH
    Write-Host "QR salvo em: $path" -ForegroundColor Green
    $qrSaved = $true
    break
  }
}
if (-not $qrSaved) {
  Write-Host "Não consegui baixar o QR por HTTP. Verifique o modal da UI (Socket.IO) e os logs." -ForegroundColor Yellow
}

# ================================
# 4) (Opcional) Envio via Cloud API (Meta/Twilio)
# ================================
if ($ENABLE_CLOUD_SEND) {
  Write-Host "-> Enviando mensagem via Cloud API..." -ForegroundColor Cyan
  $sendBody = @{ to = $TO_NUMBER; text = $TEST_TEXT }
  $sendRes = Invoke-Api -Method POST -Url "$BASE/api/integrations/whatsapp/send" -Headers $Headers -Body $sendBody
  $prov = $sendRes.provider
  if ($prov) { Write-Host ("Cloud send OK. Provider={0}" -f $prov) -ForegroundColor Green }
  else { Write-Host "Cloud send OK." -ForegroundColor Green }
}

# ================================
# 5) (Opcional) Logout
# ================================
try {
  Write-Host "-> Logout (opcional)..." -ForegroundColor Cyan
  Invoke-Api -Method POST -Url "$BASE/api/integrations/whatsapp/logout" -Headers $Headers -Body @{}
  Write-Host "Logout OK." -ForegroundColor Green
} catch {
  Write-Host "Logout falhou (provavelmente não conectado). Ignorando." -ForegroundColor Yellow
}

Write-Host "`nConcluído." -ForegroundColor Green