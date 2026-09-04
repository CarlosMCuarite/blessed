@echo off
setlocal
cd /d "%~dp0"

echo ==========================================
echo  BLESSED - SUBIR PROYECTO ACTUALIZADO
echo ==========================================
echo.

git init
git branch -M main

git remote get-url origin >nul 2>nul
if %errorlevel% equ 0 (
  git remote set-url origin https://github.com/CarlosMCuarite/blessed.git
) else (
  git remote add origin https://github.com/CarlosMCuarite/blessed.git
)

echo Verificando que los secretos NO se incluyan...
git check-ignore backend/.env >nul 2>nul
if %errorlevel% neq 0 (
  echo ERROR: backend/.env no esta ignorado. Se cancela.
  pause
  exit /b 1
)

git check-ignore .private/RENDER_VARIABLES.txt >nul 2>nul
if %errorlevel% neq 0 (
  echo ERROR: .private no esta ignorado. Se cancela.
  pause
  exit /b 1
)

git add .
git status

echo.
echo IMPORTANTE: backend/.env y .private NO deben aparecer arriba.
echo.
git commit -m "Configurar conexion Supabase y sistema profesional"
git push -u origin main

echo.
echo Listo.
pause
endlocal
