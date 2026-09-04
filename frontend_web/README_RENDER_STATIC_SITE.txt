FRONTEND WEB - RENDER STATIC SITE
=================================

Usa EL MISMO repositorio GitHub: CarlosMCuarite/blessed

Crear manualmente:
New -> Static Site

Branch:
main

Root Directory:
frontend_web

Build Command:
echo "Frontend listo"

Publish Directory:
.

El frontend ya apunta al backend:
https://blessed-x6m2.onrender.com

Después de que Render te entregue la URL del frontend, por ejemplo:
https://blessed-web.onrender.com

Ve al Web Service del backend -> Environment y agrega:
FRONTEND_ORIGIN=https://blessed-web.onrender.com

Luego redeploy del backend.

NO usar Blueprint.
NO crear otro repositorio.
