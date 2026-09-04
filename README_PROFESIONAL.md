
## Despliegue actual en Render

Este proyecto usa **un solo Web Service**.

- `backend/public/` contiene el frontend que Express sirve en `/`.
- `backend/server.js` expone la API y webhooks.
- No crear un Static Site separado.
- No usar Blueprint.

# SISTEMA DE RESERVAS PARA BARBERÍA — PROFESIONAL V2

Esta entrega reemplaza la interfaz MVP por una estructura profesional y escalable.

## Qué incluye

### Cliente
- Reserva pública sin cuenta.
- Selección de barbero.
- Selector visual de 14 días.
- Horarios disponibles.
- Validación de nombre y teléfono.
- Confirmación de reserva.

### Barbero
- Dashboard de citas de hoy.
- Agenda de próximas citas.
- Configuración semanal en bloques de 1 hora.
- Marcar una cita como atendida.
- Push FCM Android/iOS.
- Notificación visible también si la app está abierta.

### Admin
- Dashboard con KPIs.
- Lista completa de reservas.
- Gestión de barberos.
- Crear barberos.
- Activar/desactivar barberos.

### Super Admin
- Panel de usuarios.
- Crear administradores.
- Restablecer contraseña de admin/barbero.
- Operaciones privilegiadas solo mediante el backend.

## Arquitectura Flutter

lib/
- app/
- core/
  - config/
  - theme/
  - utils/
  - widgets/
- data/
  - models/
  - repositories/
- services/
- features/
  - public_booking/
  - auth/
  - admin/
  - barber/
  - super_admin/

La UI no contiene claves de servicio.

## Si YA instalaste el SQL del MVP

NO vuelvas a ejecutar todo el esquema.

Ejecuta solamente:

supabase/upgrade_mvp_a_profesional_v2.sql

Esto añade:
- dispositivos_usuario
- registrar_dispositivo()
- marcar_reserva_atendida()
- migración del FCM token anterior

## Si es un proyecto Supabase NUEVO

Ejecuta:

supabase/schema_profesional_v2.sql

## Render

Reemplaza la versión anterior del backend por esta carpeta backend/.

Variables:
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- FIREBASE_SERVICE_ACCOUNT_JSON
- WEBHOOK_SECRET
- PORT

El webhook sigue apuntando a:

POST /webhooks/reserva

Header:
x-webhook-secret: <WEBHOOK_SECRET>

## Flutter

Android:
1. Coloca android/app/google-services.json
2. PREPARAR_WINDOWS_ANDROID.bat
3. flutterfire configure
4. flutter run con --dart-define

iPhone:
1. Coloca ios/Runner/GoogleService-Info.plist
2. ./PREPARAR_MAC.command
3. flutterfire configure
4. Configura APNs/Push Notifications en Xcode/Firebase
5. Compila desde macOS

Ejemplo:

flutter run --dart-define=SUPABASE_URL=https://TU_PROYECTO.supabase.co --dart-define=SUPABASE_PUBLISHABLE_KEY=TU_KEY --dart-define=BACKEND_URL=https://TU_SERVICIO.onrender.com

## Identificador móvil

Android applicationId / iOS bundle id base:
com.nexus51.barberia

Cámbialo antes de publicar si la barbería tendrá su propia marca.

## Importante

Las credenciales reales de:
- Supabase
- Firebase
- Apple APNs

no deben incluirse dentro de un ZIP compartido ni subirse a Git.


## Nota sobre Android/iOS generados

La carpeta contiene la configuración fuente y scripts para Android/iOS.
Si tu copia todavía no contiene archivos generados específicos de tu versión local
de Flutter (por ejemplo `gradlew` o `project.pbxproj`), ejecuta el script de preparación.
El script completa esos archivos usando tu SDK Flutter instalado y conserva `lib/`
y `pubspec.yaml`.

Esto es preferible a fijar archivos Gradle/Xcode de una versión distinta a la que
usarás para publicar.
