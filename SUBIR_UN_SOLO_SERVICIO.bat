@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo  BLESSED - UN SOLO SERVICIO RENDER
echo ============================================

git add .
git status
git commit -m "Integrar frontend y backend en un solo Web Service"
git push origin main

echo.
echo Render hara auto-deploy del Web Service existente.
pause
endlocal
