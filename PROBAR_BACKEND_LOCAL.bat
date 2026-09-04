@echo off
setlocal
cd /d "%~dp0backend"

where node >nul 2>nul
if %errorlevel% neq 0 (
  echo ERROR: Instala Node.js LTS primero.
  pause
  exit /b 1
)

call npm install
if %errorlevel% neq 0 exit /b 1

echo.
echo API iniciando. Luego abre:
echo http://localhost:10000/health
echo.
call npm start
endlocal
