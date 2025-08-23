@echo off
setlocal ENABLEDELAYEDEXPANSION
REM ==================================================================
REM sync-main.bat  —  Mantém o branch local igual ao origin/main
REM Uso:  sync-main.bat [C:\caminho\do\repo] [branch] [/nobackup]
REM  - repo (opcional): caminho do repositório (default: pasta atual)
REM  - branch (opcional): default "main"
REM  - /nobackup: não cria branch de backup antes do reset
REM ==================================================================

REM --------- Parâmetros ---------
set "REPO=%~1"
if "%REPO%"=="" set "REPO=%cd%"
set "BRANCH=%~2"
if "%BRANCH%"=="" set "BRANCH=main"

set "FLAG_NOBACKUP=%~3"
if /I "%FLAG_NOBACKUP%"=="/nobackup" ( set "NOBACKUP=1" ) else ( set "NOBACKUP=0" )

REM --------- Checagens básicas ---------
where git >nul 2>&1
if errorlevel 1 (
  echo [ERRO] Git nao encontrado no PATH.
  echo Instale Git ou abra o "Git Bash" / Prompt com Git.
  exit /b 1
)

if not exist "%REPO%\.git" (
  echo [ERRO] Nao encontrei um repo Git em "%REPO%".
  exit /b 1
)

REM --------- Abort rebase/merge se existirem (ignora erro) ---------
git -C "%REPO%" rebase --abort >nul 2>&1
git -C "%REPO%" merge --abort  >nul 2>&1

REM --------- Buscar remoto ---------
echo [Info] Buscando remoto...
git -C "%REPO%" fetch origin
if errorlevel 1 (
  echo [ERRO] Falha no git fetch origin.
  exit /b 1
)

REM --------- Verifica se origin/BRANCH existe ---------
git -C "%REPO%" rev-parse --verify --quiet origin/%BRANCH% >nul
if errorlevel 1 (
  echo [ERRO] O branch "origin/%BRANCH%" nao existe.
  echo Use:  sync-main.bat ^<repo^> ^<branch^>
  exit /b 1
)

REM --------- Troca para BRANCH local (cria se nao existir) ---------
for /f "delims=" %%b in ('git -C "%REPO%" branch --list %BRANCH%') do set HAVE_LOCAL=1
if "!HAVE_LOCAL!"=="1" (
  git -C "%REPO%" switch %BRANCH% || (echo [ERRO] Falha ao trocar para %BRANCH% & exit /b 1)
) else (
  echo [Info] Branch local %BRANCH% nao existe. Criando a partir de origin/%BRANCH%...
  git -C "%REPO%" switch -c %BRANCH% origin/%BRANCH% || (echo [ERRO] Falha ao criar %BRANCH% & exit /b 1)
)

REM --------- Detectar sujeira no working tree ---------
for /f "delims=" %%s in ('git -C "%REPO%" status --porcelain') do set DIRTY=1

REM --------- Detectar commits locais a frente do remoto ---------
for /f "tokens=1,2" %%a in ('git -C "%REPO%" rev-list --left-right --count origin/%BRANCH%...%BRANCH%') do (
  set BEHIND=%%a
  set AHEAD=%%b
)

REM --------- Se houver sujeira ou commits a frente, criar backup (a nao ser /nobackup) ---------
if "!NOBACKUP!"=="0" (
  if defined DIRTY ( set NEED_BACKUP=1 )
  if "!AHEAD!" NEQ "0" ( set NEED_BACKUP=1 )
  if defined NEED_BACKUP (
    REM Criar timestamp robusto (assumindo DD/MM/YYYY e HH:MM:SS.xx)
    set hh=%time:~0,2%
    if "!hh:~0,1!"==" " set hh=0!hh:~1,1!
    set nn=%time:~3,2%
    set ss=%time:~6,2%
    set yyyy=%date:~-4%
    set mm=%date:~3,2%
    set dd=%date:~0,2%
    set STAMP=!yyyy!!mm!!dd!-!hh!!nn!!ss!
    set BAK=backup/%BRANCH%-!STAMP!
    echo [Info] Criando branch de backup: !BAK!
    git -C "%REPO%" branch "!BAK!" || (echo [ERRO] Falha ao criar backup. Use /nobackup para pular. & exit /b 1)
  )
)

REM --------- Resetar e limpar ---------
echo [Info] Sincronizando %BRANCH% <= origin/%BRANCH% ...
git -C "%REPO%" reset --hard origin/%BRANCH%
if errorlevel 1 (
  echo [ERRO] Falha no reset. Verifique permiss^~oes e travas.
  exit /b 1
)

git -C "%REPO%" clean -fd
if errorlevel 1 (
  echo [ERRO] Falha no clean.
  exit /b 1
)

echo [OK] %BRANCH% agora esta identico a origin/%BRANCH% em:
echo      %REPO%
endlocal
exit /b 0
