# Supabase configurado

El proyecto Flutter ya apunta al proyecto Supabase:

`https://ebqlluyzcmcbrexsrofv.supabase.co`

La aplicación móvil usa la clave pública/anon configurada en `AppConfig`.
La `service_role` NO está escrita en archivos versionados y solo existe en
`backend/.env` y `.private/`, ambos excluidos por `.gitignore`.

## Backend local

```bash
cd backend
npm install
npm start
```

## Comprobar

Abrir:

`http://localhost:10000/health`

## Render

Copia las variables privadas desde `.private/RENDER_VARIABLES.txt`
hacia Render > Environment. No subas la carpeta `.private` a GitHub.
