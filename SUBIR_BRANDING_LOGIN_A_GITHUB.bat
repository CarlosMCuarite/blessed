@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo  SUBIR CAMBIOS BLESSED BRANDING + LOGIN
echo ============================================

git add .
git status
git commit -m "Actualizar branding y login Blessed Barber Studio"
git push origin main

echo.
echo GitHub actualizado. Render hara auto deploy.
pause
endlocal
