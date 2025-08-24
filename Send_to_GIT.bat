@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM ======= CONFIGURE AQUI =======
set "REPO_DIR=C:\Projetos App\cresceja"
set "REMOTE_URL=git@github.com:rodrigooidr/cresceja.git"
set "BRANCH=main"
REM Remover do índice tudo que estiver ignorado (.gitignore) mas por engano já foi versionado? 1=sim
set "CLEAN_TRACKED_IGNORED=1"
REM 0 = --force-with-lease (mais seguro) | 1 = --force (destrutivo)
set "HARD_FORCE=0"
REM ==============================

set "LOG=%TEMP%\git_push_log.txt"
echo. > "%LOG%"
echo [LOG] Iniciando em %DATE% %TIME% > "%LOG%"
echo [INFO] Log em: %LOG%

REM --- Requisitos básicos
git --version >nul 2>&1 || (echo [ERRO] Git nao encontrado. Instale o Git. & exit /b 1)
if not exist "%REPO_DIR%" (echo [ERRO] Pasta "%REPO_DIR%" nao existe. & exit /b 1)

REM --- Evita warnings de "unsafe repository" e long paths no Windows
git config --global --add safe.directory "%REPO_DIR%" 1>>"%LOG%" 2>&1
git config --global core.longpaths true 1>>"%LOG%" 2>&1

pushd "%REPO_DIR%" 1>>"%LOG%" 2>&1

REM --- Inicializa repo se preciso
if not exist ".git" (
  echo [INFO] Inicializando repositório...
  git init 1>>"%LOG%" 2>&1 || goto :fail
)

REM --- Identidade (só se estiver vazia)
for /f "delims=" %%i in ('git config user.name') do set GITNAME=%%i
if "%GITNAME%"=="" git config user.name "Rodrigo Oliveira" 1>>"%LOG%" 2>&1
for /f "delims=" %%i in ('git config user.email') do set GITEMAIL=%%i
if "%GITEMAIL%"=="" git config user.email "rodrigooidr@hotmail.com" 1>>"%LOG%" 2>&1

REM --- Branch alvo
git checkout -B "%BRANCH%" 1>>"%LOG%" 2>&1 || goto :fail

REM --- Remote origin
for /f "delims=" %%r in ('git remote 2^>nul') do set HASREMOTE=%%r
if "%HASREMOTE%"=="" (
  git remote add origin "%REMOTE_URL%" 1>>"%LOG%" 2>&1 || goto :fail
) else (
  git remote set-url origin "%REMOTE_URL%" 1>>"%LOG%" 2>&1
)

echo [DEBUG] Remote atual:
git remote -v

REM --- Limpa do índice arquivos ignorados que estejam rastreados por engano
if "%CLEAN_TRACKED_IGNORED%"=="1" (
  echo [INFO] Removendo do índice arquivos ignorados que já estavam rastreados...
  for /f "delims=" %%F in ('git ls-files -ci --exclude-standard') do (
    git rm -r --cached --ignore-unmatch "%%F" 1>>"%LOG%" 2>&1
  )
)

REM --- Adiciona mudanças respeitando o .gitignore
echo [INFO] Adicionando mudanças...
git add -A 1>>"%LOG%" 2>&1 || goto :fail

REM --- Garante commit inicial se necessário
git rev-parse --verify HEAD 1>>"%LOG%" 2>&1
if errorlevel 1 (
  echo [INFO] Criando commit inicial...
  git commit -m "chore: initial commit" 1>>"%LOG%" 2>&1 || goto :fail
)

REM --- Só commita se houver mudanças
for /f "delims=" %%s in ('git status --porcelain') do set HASCHANGES=1
if defined HASCHANGES (
  git commit -m "chore: sync (%DATE% %TIME%)" 1>>"%LOG%" 2>&1 || goto :fail
) else (
  echo [INFO] Sem mudanças novas para commitar.
)

REM --- Sincroniza e faz push (verboso)
echo [INFO] Buscando estado do remoto...
git fetch origin 1>>"%LOG%" 2>&1

echo [INFO] Enviando para %REMOTE_URL% (%BRANCH%)...
if "%HARD_FORCE%"=="1" (
  git push -u origin "%BRANCH%" --force -v || goto :fail
) else (
  git push -u origin "%BRANCH%" --force-with-lease -v || goto :fail
)

echo [OK] Push concluido com sucesso.
popd 1>>"%LOG%" 2>&1
exit /b 0

:fail
echo.
echo [ERRO] Falhou. Veja detalhes no log: %LOG%
echo.
type "%LOG%"
popd 1>>"%LOG%" 2>&1
exit /b 1
