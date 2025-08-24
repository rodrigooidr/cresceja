@echo off
setlocal enabledelayedexpansion

REM ======= CONFIGURE AQUI =======
set "REPO_DIR=C:\Projetos App\cresceja"
set "REMOTE_URL=git@github.com:rodrigooidr/cresceja.git"
set "BRANCH=main"
REM 0 = usa --force-with-lease (mais seguro), 1 = usa --force (destrutivo)
set "HARD_FORCE=0"
REM 1 = remover do índice tudo que o .gitignore cobre (se já foi versionado por engano)
set "CLEAN_TRACKED_IGNORED=1"
REM ==============================

git --version >nul 2>&1 || (echo [ERRO] Git nao encontrado. Instale o Git e tente novamente. & exit /b 1)
if not exist "%REPO_DIR%" (echo [ERRO] Pasta "%REPO_DIR%" nao existe. & exit /b 1)

pushd "%REPO_DIR%"

if not exist ".git" (
  echo [INFO] Inicializando repositorio...
  git init || goto :fail
)

git checkout -B "%BRANCH%" || goto :fail

REM Identidade padrao (so se nao estiver configurada)
for /f "delims=" %%i in ('git config user.name') do set GITNAME=%%i
if "%GITNAME%"=="" git config user.name "Rodrigo Oliveira"
for /f "delims=" %%i in ('git config user.email') do set GITEMAIL=%%i
if "%GITEMAIL%"=="" git config user.email "rodrigooidr@hotmail.com"

REM Configura remote origin
git remote remove origin >nul 2>&1
git remote add origin "%REMOTE_URL%" || goto :fail

REM ===== Limpeza de arquivos JA rastreados que estao no .gitignore =====
if "%CLEAN_TRACKED_IGNORED%"=="1" (
  if exist ".gitignore" (
    echo [INFO] Limpando arquivos rastreados que o .gitignore cobre...
    setlocal disableDelayedExpansion
    for /f "usebackq delims=" %%L in (".gitignore") do (
      set "PAT=%%L"
      setlocal enabledelayedexpansion
      REM pula linhas vazias, comentarios (#) e negacoes (!)
      if not "!PAT!"=="" if not "!PAT:~0,1!"=="#" if not "!PAT:~0,1!"=="!" (
        git rm -r --cached --ignore-unmatch "!PAT!" >nul 2>&1
      )
      endlocal
    )
    endlocal
  )
)

echo [INFO] Adicionando arquivos (respeitando .gitignore)...
git add -A || goto :fail

git commit -m "chore: clean ignored & push (%date% %time%)" --allow-empty || goto :fail

if "%HARD_FORCE%"=="1" (
  echo [WARN] Forcando sobrescrita no remoto com --force...
  git push -u origin "%BRANCH%" --force || goto :fail
) else (
  echo [INFO] Empurrando com --force-with-lease (mais seguro)...
  git push -u origin "%BRANCH%" --force-with-lease || goto :fail
)

echo [OK] Push concluido com sucesso para %REMOTE_URL% (%BRANCH%).
popd
exit /b 0

:fail
echo [ERRO] Ocorreu um erro durante o processo. Verifique as mensagens acima.
popd
exit /b 1
