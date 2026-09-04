@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo  BLESSED - SUBIR FRONTEND PROFESIONAL
echo ============================================

git add .
git status
git commit -m "Mejorar frontend profesional Blessed Barber Studio"
git push origin main

echo.
echo GitHub actualizado. Render debe iniciar Auto Deploy.
pause
endlocal
