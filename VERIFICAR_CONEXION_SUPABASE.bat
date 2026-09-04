@echo off
cd /d "%~dp0"

echo ==========================================
echo  VERIFICAR CONFIGURACION SUPABASE
echo ==========================================
echo.

findstr /C:"ebqlluyzcmcbrexsrofv.supabase.co" app_flutter\lib\core\config\app_config.dart >nul
if %errorlevel% neq 0 (
  echo [ERROR] Flutter no contiene la URL de Supabase.
  pause
  exit /b 1
)
echo [OK] Flutter conectado al proyecto Supabase.

if exist backend\.env (
  echo [OK] backend\.env existe.
) else (
  echo [ERROR] Falta backend\.env.
  pause
  exit /b 1
)

git check-ignore backend/.env >nul 2>nul
if %errorlevel% equ 0 (
  echo [OK] backend\.env esta protegido por .gitignore.
) else (
  echo [ADVERTENCIA] Verifica .gitignore antes de hacer git add .
)

git check-ignore .private/RENDER_VARIABLES.txt >nul 2>nul
if %errorlevel% equ 0 (
  echo [OK] .private esta protegido por .gitignore.
) else (
  echo [ADVERTENCIA] La carpeta .private debe estar ignorada.
)

echo.
echo Configuracion Supabase preparada.
pause
