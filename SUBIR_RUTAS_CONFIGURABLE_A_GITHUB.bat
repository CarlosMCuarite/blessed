@echo off
setlocal
cd /d "%~dp0"

echo ===============================================
echo  BLESSED - RUTAS + CONFIGURACION
echo ===============================================

git add .
git status
git commit -m "Agregar rutas y configuracion central Blessed"
git push origin main

echo.
echo GitHub actualizado. Render hara Auto Deploy.
echo.
echo IMPORTANTE:
echo Ejecuta supabase\03_configuracion_sistema.sql en Supabase.
pause
endlocal
