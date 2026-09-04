@echo off
setlocal
title Probar conexion Node + Supabase

echo ============================================
echo   PRUEBA BACKEND NODE -> SUPABASE
echo ============================================
echo.

REM Este BAT debe ejecutarse dentro de la carpeta backend
REM o copiarse dentro de ella.

if not exist ".env" (
    echo [ERROR] No encuentro el archivo .env en esta carpeta.
    echo.
    echo Copia este archivo BAT dentro de:
    echo   blessed\backend\
    echo.
    pause
    exit /b 1
)

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js no esta instalado o no esta en PATH.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [INFO] Instalando dependencias...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] npm install fallo.
        pause
        exit /b 1
    )
)

echo.
echo [INFO] Consultando tabla public.usuarios en Supabase...
echo.

node -e "import('dotenv/config').then(async()=>{const {createClient}=await import('@supabase/supabase-js');const s=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);const {data,error}=await s.from('usuarios').select('id,nombre,rol,activo');if(error){console.error('ERROR SUPABASE:',error);process.exit(1)}console.log('CONEXION OK');console.log('Usuarios encontrados:',data.length);console.table(data)})"

echo.
if %errorlevel% equ 0 (
    echo ============================================
    echo   PRUEBA TERMINADA CORRECTAMENTE
    echo ============================================
) else (
    echo ============================================
    echo   HUBO UN ERROR EN LA CONEXION
    echo ============================================
)

echo.
pause
endlocal
