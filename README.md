# Satélite de inscripciones — NEXO Fenalco Santander

App pública reusable que renderiza el formulario de inscripción de cualquier evento (leyendo la config de NEXO por API) y reenvía la inscripción a NEXO con una API key. Es la única superficie pública; NEXO permanece interno.

## Stack
Node.js (≥18, `fetch` nativo) + Express + Alpine.js + Tailwind (CDN).

## Estructura
- `server.js` — rutas `GET /f/:slug` (renderiza el formulario) y `POST /f/:slug` (reenvía la inscripción a NEXO con API key).
- `views/` — `layout.js`, `renderForm.js`, `renderConfirmacion.js`, `renderError.js`.

## Variables de entorno (`.env`)
```
PORT=5050
NEXO_URL=http://localhost:5000          # en prod: la URL de NEXO en Render
NEXO_API_KEY=...                        # DEBE coincidir con SATELITE_API_KEY de NEXO
```
> `.env` está en `.gitignore` — nunca se commitea. En producción las variables se configuran en el panel de Render.

## Local
```
npm install
copy .env.example .env   # y rellenar NEXO_API_KEY
npm start                # http://localhost:5050
```

## Requisitos del lado NEXO
`.env` (o Environment de Render) de NEXO con:
- `SATELITE_API_KEY` = igual a `NEXO_API_KEY` de aquí.
- `SATELITE_URL` = URL pública de este satélite.
Y un evento con el formulario habilitado (genera el `slug`).

## Rutas
- `GET /f/:slug` → formulario público (sin login).
- `POST /f/:slug` → reenvía la inscripción a NEXO (server-to-server, con API key).

## Despliegue
Render (Web Service, región Oregon como `fenalco-crm`). Ver `despliegue-satelite-render.md` del proyecto CRM.
