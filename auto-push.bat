@echo off
setlocal EnableExtensions

echo === git_diag.bat START ===
echo (Esta janela NAO vai fechar sozinha)
echo.
pause

REM 1) Descobrir git.exe
set "GIT="
for %%G in (git.exe) do set "GIT=%%~$PATH:G"
if not defined GIT if exist "%ProgramFiles%\Git\cmd\git.exe" set "GIT=%ProgramFiles%\Git\cmd\git.exe"
if not defined GIT if exist "%ProgramFiles(x86)%\Git\cmd\git.exe" set "GIT=%ProgramFiles(x86)%\Git\cmd\git.exe"
if not defined GIT if exist "%LocalAppData%\Programs\Git\cmd\git.exe" set "GIT=%LocalAppData%\Programs\Git\cmd\git.exe"

echo Script dir: "%~dp0"
echo CWD       : "%cd%"
echo Git exe   : "%GIT%"
echo.

if not defined GIT (
  echo [ERRO] Git nao encontrado. Instale Git for Windows ou ajuste o caminho do executavel.
  goto END
)

"%GIT%" --version || (echo [ERRO] git.exe nao respondeu. & goto END)

REM 2) Ir para a pasta do script (deve ser a RAIZ do repo)
cd /d "%~dp0" || (echo [ERRO] Nao consegui entrar em "%~dp0" & goto END)
if not exist ".git" (
  echo [ERRO] .git nao encontrado aqui. Coloque este .bat na RAIZ do repositorio.
  goto END
)

echo [OK] git encontrado e .git presente nesta pasta.
echo.

"%GIT%" remote -v
"%GIT%" branch --show-current

:END
echo.
echo (FIM / git_diag) Pressione uma tecla para fechar...
pause >nul
endlocal
