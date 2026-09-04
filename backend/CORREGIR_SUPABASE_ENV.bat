@echo off
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0"

echo ==============================================
echo  CORREGIR CONEXION SUPABASE - BACKEND
echo ==============================================
echo.

if not exist "server.js" (
    echo [ERROR] Este BAT debe estar dentro de la carpeta:
    echo         SISTEMA_BARBERIA_PROFESIONAL\backend\
    echo.
    pause
    exit /b 1
)

echo 1. Entra a Supabase Dashboard.
echo 2. Ve a Project Settings / API Keys.
echo 3. Copia la clave SERVICE_ROLE del proyecto actual.
echo.
set /p SERVICE_KEY=PEGA AQUI LA SERVICE_ROLE Y PRESIONA ENTER: 

if "%SERVICE_KEY%"=="" (
    echo.
    echo [ERROR] No ingresaste ninguna clave.
    pause
    exit /b 1
)

> ".env" (
  echo SUPABASE_URL=https://ebqlluyzcmcbrexsrofv.supabase.co
  echo SUPABASE_SERVICE_ROLE_KEY=%SERVICE_KEY%
  echo WEBHOOK_SECRET=blessed_barberia_webhook_2026_cambiar_en_render
  echo PORT=10000
)

echo.
echo [OK] backend\.env actualizado.
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ADVERTENCIA] Node.js no esta en PATH.
    echo El archivo .env si fue actualizado.
    pause
    exit /b 0
)

if not exist "node_modules" (
    echo Instalando dependencias...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] npm install fallo.
        pause
        exit /b 1
    )
)

echo.
echo Probando conexion Node -> Supabase...
echo.

node -e "import('dotenv/config').then(async()=>{const {createClient}=await import('@supabase/supabase-js');const s=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);const {data,error}=await s.from('usuarios').select('id,nombre,rol,activo');if(error){console.error('ERROR SUPABASE:',error);process.exit(1)}console.log('CONEXION OK');console.log('Usuarios encontrados:',data.length);console.table(data)})"

echo.
if %errorlevel% equ 0 (
    echo ==============================================
    echo   CONEXION SUPABASE CORRECTA
    echo ==============================================
) else (
    echo ==============================================
    echo   LA CLAVE SIGUE SIENDO INVALIDA
    echo ==============================================
    echo Vuelve a copiarla directamente desde Supabase.
)

echo.
pause
endlocal
