@echo off
setlocal

rem === AJUSTE se seu git.exe estiver em outro lugar ===
set "GIT_EXE=C:\Program Files\Git\cmd\git.exe"
set "BRANCH=main"

rem === Ir pra pasta do script (raiz do repo) ===
cd /d "%~dp0"
if errorlevel 1 goto FAIL_CD

if not exist "%GIT_EXE%" goto FAIL_GIT
if not exist ".git" goto FAIL_NOREPO

rem Garantir remote origin (silencioso)
"%GIT_EXE%" remote get-url origin >nul 2>&1 || "%GIT_EXE%" remote add origin "https://github.com/rodrigooidr/cresceja.git" >nul 2>&1

rem Buscar remoto (mostrar erro se falhar)
"%GIT_EXE%" fetch origin "%BRANCH%" --prune >nul 2>&1
if errorlevel 1 goto FAIL_FETCH

rem === Listar arquivos A/M num arquivo temporario (sem pipes) ===
set "AM_FILE=%TEMP%\am_%RANDOM%.txt"
>"%AM_FILE%" "%GIT_EXE%" diff --diff-filter=AM --name-only HEAD..origin/%BRANCH% 2>nul

rem === Contar linhas do arquivo (sem pipes) ===
set /a AM_COUNT=0
for /f "usebackq delims=" %%L in ("%AM_FILE%") do set /a AM_COUNT+=1

if %AM_COUNT% EQU 0 (
  echo Nenhum arquivo para copiar ^(HEAD == origin/%BRANCH%^).
  del "%AM_FILE%" >nul 2>&1
  goto END
)

rem === Copiar A/M com contadores ===
set /a COPIED=0
set /a FAILED=0
for /f "usebackq delims=" %%F in ("%AM_FILE%") do (
  "%GIT_EXE%" checkout origin/%BRANCH% -- "%%F" >nul 2>&1
  if errorlevel 1 (
    echo ERRO: %%F
    set /a FAILED+=1
  ) else (
    echo Copiado: %%F
    set /a COPIED+=1
  )
)
del "%AM_FILE%" >nul 2>&1

rem (Opcional) Remover silenciosamente arquivos deletados no remoto
for /f "usebackq delims=" %%F in (`"%GIT_EXE%" diff --diff-filter=D --name-only HEAD..origin/%BRANCH%`) do (
  if exist "%%F" del /f /q "%%F" 2>nul
)

echo Resumo: copiados %COPIED%  ^|  erros %FAILED%
goto END

:FAIL_CD
echo ERRO: nao consegui entrar em "%~dp0"
goto END
:FAIL_GIT
echo ERRO: git.exe nao existe em "%GIT_EXE%"
goto END
:FAIL_NOREPO
echo ERRO: .git nao encontrado (este .bat deve estar na raiz do repo)
goto END
:FAIL_FETCH
echo ERRO: fetch de origin/%BRANCH% falhou. Verifique rede/credenciais.
goto END

:END
echo(
echo (FIM) Pressione uma tecla para fechar...
pause >nul
endlocal
