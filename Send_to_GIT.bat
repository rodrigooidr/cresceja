cd "C:\Projetos App\cresceja"

rem garanta que o remoto aponta pro seu repo
git remote remove origin 2>nul
git remote add origin https://github.com/rodrigooidr/cresceja.git

rem comite o estado atual
git add -A
git commit -m "Overwrite remote with local state" || echo (sem alterações locais)

rem empurra forçando (mantém alguma segurança)
git push --force-with-lease -u origin main

echo Dados alterados com sucesso!
pause >nul
endlocal