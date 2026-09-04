@echo off
setlocal
cd /d "%~dp0"
echo Archivos sensibles rastreados:
git ls-files | findstr /i ".env .private google-services.json GoogleService-Info.plist service-account firebase-adminsdk"
if %errorlevel% neq 0 echo OK: no se encontraron secretos rastreados.
echo.
git status
pause
endlocal
