@echo off
setlocal
cd /d "%~dp0"

echo ==================================================
echo  BLESSED - SUBIR FORMATO BARBEROS REDISENADO
echo ==================================================

git add .
git status
git commit -m "Integrar formato barberia reservas catalogo y panel"
git push origin main

echo.
echo GitHub actualizado. Render hara Auto Deploy.
echo.
echo IMPORTANTE:
echo Ejecuta supabase\05_formato_barberos_catalogo.sql en Supabase.
pause
endlocal
