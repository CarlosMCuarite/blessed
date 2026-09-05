# Blessed — diseño basado directamente en el otro sistema de barbería

Esta versión usa **blessed_rediseno.zip como base funcional** y reproduce
el lenguaje visual de `barberos-sistema-main`:

- Login dividido 50/50 con panel oscuro de marca y formulario blanco.
- Sidebar `gray-900`, navegación vertical y usuario al pie.
- Topbar blanco fijo.
- Dashboard con tarjetas estadísticas, gráfico, agenda de hoy y acciones rápidas.
- Tablas y filtros con el mismo estilo visual.
- Calendario mensual.
- Modales con la misma jerarquía visual.
- Portal de reservas inspirado directamente en `reservar.html`.

## Módulos incluidos

- Dashboard
- Reservas
- Calendario
- Barberos
- Catálogo de servicios
- Galería
- Mi agenda
- Mis horarios
- Usuarios
- Seguridad
- Configuración
- Home público
- Catálogo público
- Reservar
- Login

## Módulos deliberadamente excluidos

No existe código ni navegación de:

- productos
- inventario
- facturación
- gastos
- finanzas
- reportes financieros
- IA
- backups / restore
- módulo separado de clientes

## Supabase

Ejecutar **una sola vez**:

`supabase/05_diseno_barberos_os.sql`

El archivo es idempotente y agrega únicamente:
- perfil profesional del barbero,
- catálogo de servicios,
- servicio/notas dentro de reservas,
- RPC de reserva pública v2,
- opciones adicionales de configuración.

No inserta servicios de ejemplo ni productos.

## Render

Sigue siendo **un solo Web Service**:

- Root Directory: `backend`
- Build Command: `npm install`
- Start Command: `npm start`

No usar Blueprint ni Static Site separado.
