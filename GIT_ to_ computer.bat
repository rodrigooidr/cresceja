cd "C:\Projetos App\cresceja"

"C:\Program Files\Git\cmd\git.exe" fetch origin --prune
"C:\Program Files\Git\cmd\git.exe" switch main  || "C:\Program Files\Git\cmd\git.exe" switch -c main --track origin/main
"C:\Program Files\Git\cmd\git.exe" reset --hard origin/main
"C:\Program Files\Git\cmd\git.exe" clean -fdx
