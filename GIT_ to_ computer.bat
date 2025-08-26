@echo off
cd /d "C:\Projetos App\cresceja" || exit /b 1

"C:\Program Files\Git\cmd\git.exe" fetch origin --prune

REM troca para main; se nao existir local, cria a partir de origin/main
"C:\Program Files\Git\cmd\git.exe" switch main  || ^
"C:\Program Files\Git\cmd\git.exe" switch -c main --track origin/main

REM sincroniza a árvore de trabalho com o remoto
"C:\Program Files\Git\cmd\git.exe" reset --hard origin/main

REM limpa APENAS arquivos NAO rastreados (mantem os IGNORADOS como node_modules)
"C:\Program Files\Git\cmd\git.exe" clean -fd

echo.
echo [OK] Atualizado sem apagar node_modules (por causa do .gitignore e do clean -fd).
pause
