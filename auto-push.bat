@echo off
setlocal

set COMMIT_MSG=Auto commit em %date% %time%
git add .
git commit -m "%COMMIT_MSG%"
git push origin main

endlocal
pause
