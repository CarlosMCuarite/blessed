# CORRER Y SUBIR EL SISTEMA

Repositorio configurado:
https://github.com/CarlosMCuarite/blessed.git

## Primero: Supabase

Proyecto:
https://ebqlluyzcmcbrexsrofv.supabase.co

Si YA ejecutaste el SQL MVP anterior:
ejecuta SOLO `supabase/upgrade_mvp_a_profesional_v2.sql`.

Si tu Supabase está vacío:
ejecuta SOLO `supabase/schema_profesional_v2.sql`.

No ejecutes los dos.

La contraseña PostgreSQL no hace falta para este backend.

## Probar en Windows

Doble clic:
`PROBAR_BACKEND_LOCAL.bat`

Luego abre:
http://localhost:10000/health

Debe responder `ok: true`.

## GitHub

Tu error en la captura es este:

`git add`

Debe ser:

`git add .`

Puedes simplemente ejecutar:
`SUBIR_A_GITHUB.bat`

Manual:
git init
git add .
git status
git commit -m "Sistema barberia profesional"
git branch -M main
git remote add origin https://github.com/CarlosMCuarite/blessed.git
git push -u origin main

Si origin ya existe:
git remote set-url origin https://github.com/CarlosMCuarite/blessed.git
git push -u origin main

## Render

Root Directory: backend
Build Command: npm install
Start Command: npm start
Health Check: /health

En Render > Environment copia los datos de:
`.private/RENDER_SECRETS.txt`

`.private/` y `backend/.env` están ignorados por Git.

Firebase puede quedar vacío por ahora. El backend arranca sin FCM.

## Webhook Supabase

Después de tener la URL Render:

POST https://TU-RENDER.onrender.com/webhooks/reserva

Tabla: reservas
Evento: INSERT

Header:
x-webhook-secret = WEBHOOK_SECRET del archivo `.private/RENDER_SECRETS.txt`

## Seguridad

Nunca subas a GitHub:
- service_role
- backend/.env
- .private/
- cuentas de servicio Firebase
- llaves APNs
