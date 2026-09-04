@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo  BLESSED - ACTUALIZAR FRONTEND
echo ============================================

if not exist "frontend_web\index.html" (
  echo ERROR: No existe frontend_web\index.html
  pause
  exit /b 1
)

if exist "backend\public" rmdir /s /q "backend\public"
xcopy /e /i /y "frontend_web" "backend\public" >nul

echo [OK] Frontend actualizado en backend\public
pause
endlocal
