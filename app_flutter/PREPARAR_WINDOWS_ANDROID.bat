@echo off
setlocal
cd /d "%~dp0"

echo =================================================
echo  BARBERIA PROFESIONAL V2 - ANDROID
echo =================================================

where flutter >nul 2>nul
if %errorlevel% neq 0 (
  echo ERROR: Flutter no esta instalado o no esta en PATH.
  pause
  exit /b 1
)

if not exist "android\gradlew.bat" (
  echo Completando archivos nativos Android con tu Flutter instalado...
  if exist ".tmp_prof_lib" rmdir /s /q ".tmp_prof_lib"
  mkdir ".tmp_prof_lib"
  xcopy /e /i /y "lib" ".tmp_prof_lib\lib" >nul
  copy /y "pubspec.yaml" ".tmp_prof_lib\pubspec.yaml" >nul
  copy /y "analysis_options.yaml" ".tmp_prof_lib\analysis_options.yaml" >nul

  flutter create --org com.nexus51 --project-name barberia_app --platforms=android .
  if %errorlevel% neq 0 exit /b 1

  rmdir /s /q "lib"
  xcopy /e /i /y ".tmp_prof_lib\lib" "lib" >nul
  copy /y ".tmp_prof_lib\pubspec.yaml" "pubspec.yaml" >nul
  copy /y ".tmp_prof_lib\analysis_options.yaml" "analysis_options.yaml" >nul
  rmdir /s /q ".tmp_prof_lib"
)

flutter pub get
flutter doctor

echo.
echo CONFIGURACION FIREBASE:
echo - Verifica android\app\google-services.json
echo - Ejecuta: flutterfire configure
echo.
echo COMPILACION:
echo flutter run --dart-define=SUPABASE_URL=... --dart-define=SUPABASE_PUBLISHABLE_KEY=... --dart-define=BACKEND_URL=...
echo.
pause
endlocal
