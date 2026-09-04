@echo off
setlocal
cd /d "%~dp0\backend"
echo ==========================================
echo  BACKEND + SUPABASE
echo ==========================================
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo ERROR: Node.js no esta instalado.
  pause
  exit /b 1
)
if not exist node_modules (
  npm install
)
npm start
endlocal
