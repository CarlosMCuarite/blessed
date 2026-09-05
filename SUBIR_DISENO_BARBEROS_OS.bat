@echo off
setlocal
cd /d "%~dp0"

echo ==================================================
echo  BLESSED - DISENO BARBEROS OS
echo ==================================================

git add .
git status
git commit -m "Aplicar dashboard y reservas estilo BarberOS a Blessed"
git push origin main

echo.
echo GitHub actualizado. Render iniciara Auto Deploy.
echo.
echo IMPORTANTE:
echo Ejecuta supabase\05_diseno_barberos_os.sql una sola vez.
pause
endlocal
