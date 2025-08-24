@echo off
setlocal EnableExtensions EnableDelayedExpansion
title Push via SSH (respeitando .gitignore)

REM ======= CONFIGURE AQUI =========================================
set "REPO_DIR=C:\Projetos App\cresceja"
set "REMOTE_URL=git@github.com:rodrigooidr/cresceja.git"
set "BRANCH=main"
REM 0 = push seguro (--force-with-lease) | 1 = push destrutivo (--force)
set "HARD_FORCE=0"
REM 1 = refaz o índice para respeitar 100% o .gitignore
set "STRICT_RESYNC=1"
REM ================================================================

REM Caminhos fixos do Git/SSH (conforme seu ambiente)
set "GIT_HOME=C:\Program Files\Git"
set "GIT_EXE=%GIT_HOME%\cmd\git.exe"
set "SSH_EXE=%GIT_HOME%\usr\bin\ssh.exe"
if not exist "%SSH_EXE%" set "SSH_EXE=%GIT_HOME%\bin\ssh.exe"

if not exist "%GIT_EXE%" (
  echo [ERRO] Git nao encontrado em: %GIT_EXE%
  echo Reinstale o Git for Windows ou ajuste o caminho acima.
  goto :PAUSE_FAIL
)
if not exist "%SSH_EXE%" (
  echo [ERRO] ssh.exe nao encontrado em: %SSH_EXE%
  echo Reinstale o Git com suporte a OpenSSH ou ajuste o caminho acima.
  goto :PAUSE_FAIL
)
if not exist "%REPO_DIR%" (
  echo [ERRO] Pasta do projeto nao existe: %REPO_DIR%
  goto :PAUSE_FAIL
)

echo [INFO] Preparando SSH/known_hosts...
set "SSH_DIR=%USERPROFILE%\.ssh"
set "KNOWN=%SSH_DIR%\known_hosts"
if not exist "%SSH_DIR%" mkdir "%SSH_DIR%" >nul 2>&1
if not exist "%KNOWN%" type nul > "%KNOWN%"

REM Registra a host key do GitHub sem prompt (ok se retornar codigo nao-zero)
"%SSH_EXE%" -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile="%KNOWN%" -T git@github.com >nul 2>&1

REM Todos os comandos git usam este ssh + known_hosts
set "GIT_SSH_COMMAND=%SSH_EXE% -o UserKnownHostsFile=%KNOWN% -o StrictHostKeyChecking=yes"

echo [INFO] Entrando no projeto...
pushd "%REPO_DIR%" >nul || goto :PAUSE_FAIL

REM Ajustes uteis no Windows
"%GIT_EXE%" config --global --add safe.directory "%REPO_DIR%" >nul 2>&1
"%GIT_EXE%" config --global core.longpaths true >nul 2>&1

if not exist ".git" (
  echo [INFO] Inicializando repositório Git...
  "%GIT_EXE%" init || goto :FAIL
)

REM Garante branch desejado
echo [INFO] Usando branch: %BRANCH%
"%GIT_EXE%" checkout -B "%BRANCH%" || goto :FAIL

REM Configura o remoto (SSH)
"%GIT_EXE%" remote remove origin >nul 2>&1
"%GIT_EXE%" remote add origin "%REMOTE_URL%" || goto :FAIL

REM (Opcional) Resync do indice p/ respeitar .gitignore
if "%STRICT_RESYNC%"=="1" (
  echo [INFO] Recriando indice respeitando .gitignore...
  "%GIT_EXE%" rm -r --cached . >nul 2>&1
)

echo [INFO] Adicionando mudanças (respeitando .gitignore)...
"%GIT_EXE%" add -A || goto :FAIL

REM Commit inicial se necessário
"%GIT_EXE%" rev-parse --verify HEAD >nul 2>&1
if errorlevel 1 (
  echo [INFO] Criando commit inicial...
  "%GIT_EXE%" commit -m "chore: initial commit" || goto :FAIL
)

REM Commita apenas se houver mudanças pendentes
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
echo Dicas:
echo  - Se aparecer "Permission denied (publickey)", adicione sua chave publica no GitHub:
echo      %USERPROFILE%\.ssh\id_ed25519.pub
echo  - Se o branch remoto for protegido, use HARD_FORCE=0 ou outro branch.
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
