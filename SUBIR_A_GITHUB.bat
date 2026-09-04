@echo off
setlocal
cd /d "%~dp0"

echo =============================================
echo  SUBIR SISTEMA BARBERIA A GITHUB
echo =============================================

where git >nul 2>nul
if %errorlevel% neq 0 (
  echo ERROR: Git no esta instalado o no esta en PATH.
  pause
  exit /b 1
)

if not exist ".git" git init

echo.
echo Agregando archivos. OJO: es git add PUNTO
git add .
git status

echo.
echo backend\.env y .private\ NO deben aparecer en "Changes to be committed".
echo.

git diff --cached --quiet
if %errorlevel% neq 0 (
  git commit -m "Sistema barberia profesional"
)

git branch -M main

git remote get-url origin >nul 2>nul
if %errorlevel% equ 0 (
  git remote set-url origin https://github.com/CarlosMCuarite/blessed.git
) else (
  git remote add origin https://github.com/CarlosMCuarite/blessed.git
)

git push -u origin main

echo.
echo LISTO.
pause
endlocal
