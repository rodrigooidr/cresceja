@echo off
setlocal EnableExtensions EnableDelayedExpansion
title Push via SSH (gitignore OK + core.sshCommand POSIX)

REM ======= CONFIG =======
set "REPO_DIR=C:\Projetos App\cresceja"
set "REMOTE_URL=git@github.com:rodrigooidr/cresceja.git"
set "BRANCH=main"
REM 0 = seguro (--force-with-lease) | 1 = destrutivo (--force)
set "HARD_FORCE=0"
REM 1 = refaz o indice p/ respeitar o .gitignore
set "STRICT_RESYNC=1"
REM ======================

REM Git/SSH instalados em C:\Program Files\Git
set "GIT_HOME=C:\Program Files\Git"
set "GIT_EXE=%GIT_HOME%\cmd\git.exe"
set "SSH_EXE=%GIT_HOME%\usr\bin\ssh.exe"
if not exist "%SSH_EXE%" set "SSH_EXE=%GIT_HOME%\bin\ssh.exe"

if not exist "%GIT_EXE%" (echo [ERRO] Git nao encontrado: %GIT_EXE% & goto :PAUSE_FAIL)
if not exist "%SSH_EXE%" (echo [ERRO] ssh.exe nao encontrado: %SSH_EXE% & goto :PAUSE_FAIL)
if not exist "%REPO_DIR%" (echo [ERRO] Pasta do projeto nao existe: %REPO_DIR% & goto :PAUSE_FAIL)

REM known_hosts + registro da host key (primeira conexao)
set "SSH_DIR=%USERPROFILE%\.ssh"
set "KNOWN=%SSH_DIR%\known_hosts"
if not exist "%SSH_DIR%" mkdir "%SSH_DIR%" >nul 2>&1
if not exist "%KNOWN%" type nul > "%KNOWN%"
"%SSH_EXE%" -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile="%KNOWN%" -T git@github.com >nul 2>&1

REM ---------- FIX: usar caminhos POSIX e aspas no core.sshCommand ----------
set "SSH_POSIX=%SSH_EXE:\=/%"
set "KNOWN_POSIX=%KNOWN:\=/%"

pushd "%REPO_DIR%" >nul || goto :PAUSE_FAIL

REM Ajustes uteis
"%GIT_EXE%" config --global --add safe.directory "%REPO_DIR%" >nul 2>&1
"%GIT_EXE%" config --global core.longpaths true >nul 2>&1

REM Limpa configuracao antiga e grava a correta (com aspas e POSIX)
"%GIT_EXE%" config --local --unset core.sshCommand >nul 2>&1
"%GIT_EXE%" config --local core.sshCommand "\"%SSH_POSIX%\" -o UserKnownHostsFile=\"%KNOWN_POSIX%\" -o StrictHostKeyChecking=yes"

echo [DEBUG] core.sshCommand = 
"%GIT_EXE%" config --local core.sshCommand

if not exist ".git" (
  echo [INFO] Inicializando repo...
  "%GIT_EXE%" init || goto :FAIL
)

echo [INFO] Usando branch: %BRANCH%
"%GIT_EXE%" checkout -B "%BRANCH%" || goto :FAIL

REM Remoto (SSH)
"%GIT_EXE%" remote remove origin >nul 2>&1
"%GIT_EXE%" remote add origin "%REMOTE_URL%" || goto :FAIL

REM Respeitar .gitignore (remove do indice itens ignorados ja rastreados)
if "%STRICT_RESYNC%"=="1" (
  echo [INFO] Recriando indice respeitando .gitignore...
  "%GIT_EXE%" rm -r --cached . >nul 2>&1
)

echo [INFO] Adicionando mudancas (respeitando .gitignore)...
"%GIT_EXE%" add -A || goto :FAIL

REM Commit inicial se preciso
"%GIT_EXE%" rev-parse --verify HEAD >nul 2>&1
if errorlevel 1 "%GIT_EXE%" commit -m "chore: initial commit" || goto :FAIL

REM Commit somente se houver mudancas
set "HASCHANGES="
for /f "delims=" %%s in ('"%GIT_EXE%" status --porcelain') do set HASCHANGES=1
if defined HASCHANGES (
  echo [INFO] Criando commit de sincronizacao...
  "%GIT_EXE%" commit -m "chore: sync" || goto :FAIL
) else (
  echo [INFO] Sem novas mudancas para commitar.
)

echo [INFO] Enviando para %REMOTE_URL% (%BRANCH%)...
if "%HARD_FORCE%"=="1" (
  "%GIT_EXE%" push -u origin "%BRANCH%" --force -v || goto :FAIL
) else (
  "%GIT_EXE%" push -u origin "%BRANCH%" --force-with-lease -v || goto :FAIL
)

echo.
echo [OK] Push concluido com sucesso!
popd >nul
goto :PAUSE_OK

:FAIL
echo.
echo [ERRO] O push falhou.
echo  - Se aparecer "Permission denied (publickey)", confirme se adicionou:
echo      %USERPROFILE%\.ssh\id_ed25519.pub  (GitHub > Settings > SSH and GPG keys)
echo  - Branch protegido bloqueia --force; use HARD_FORCE=0 ou outro branch.
popd >nul
goto :PAUSE_FAIL

:PAUSE_OK
echo.
pause
exit /b 0

:PAUSE_FAIL
echo.
pause
exit /b 1
