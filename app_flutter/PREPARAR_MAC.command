#!/bin/bash
set -e
cd "$(dirname "$0")"

echo "================================================="
echo " BARBERÍA PROFESIONAL V2 - iOS"
echo "================================================="

command -v flutter >/dev/null 2>&1 || {
  echo "ERROR: Flutter no está instalado o no está en PATH."
  exit 1
}

if [ ! -f "ios/Runner.xcodeproj/project.pbxproj" ]; then
  echo "Completando archivos nativos iOS con tu Flutter instalado..."
  rm -rf .tmp_prof_lib
  mkdir -p .tmp_prof_lib
  cp -R lib .tmp_prof_lib/lib
  cp pubspec.yaml .tmp_prof_lib/pubspec.yaml
  cp analysis_options.yaml .tmp_prof_lib/analysis_options.yaml

  flutter create --org com.nexus51 --project-name barberia_app --platforms=ios .

  rm -rf lib
  cp -R .tmp_prof_lib/lib lib
  cp .tmp_prof_lib/pubspec.yaml pubspec.yaml
  cp .tmp_prof_lib/analysis_options.yaml analysis_options.yaml
  rm -rf .tmp_prof_lib
fi

flutter pub get
flutter doctor

if command -v pod >/dev/null 2>&1; then
  (cd ios && pod install --repo-update)
else
  echo "AVISO: CocoaPods no está instalado."
fi

echo
echo "CONFIGURACIÓN FINAL iPHONE:"
echo "1) Verifica ios/Runner/GoogleService-Info.plist"
echo "2) Ejecuta flutterfire configure"
echo "3) Abre ios/Runner.xcworkspace"
echo "4) Configura tu Team / Bundle ID"
echo "5) Activa Push Notifications"
echo "6) Activa Background Modes > Remote notifications"
