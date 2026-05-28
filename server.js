require('dotenv').config();
const express = require('express');
const { renderForm }         = require('./views/renderForm');
const { renderConfirmacion } = require('./views/renderConfirmacion');
const { renderError }        = require('./views/renderError');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const NEXO_URL     = process.env.NEXO_URL     || 'http://localhost:5000';
const NEXO_API_KEY = process.env.NEXO_API_KEY || '';

async function nexoGet(path) {
  return fetch(`${NEXO_URL}${path}`, {
    headers: { 'x-api-key': NEXO_API_KEY },
  });
}

async function nexoPost(path, body) {
  return fetch(`${NEXO_URL}${path}`, {
    method: 'POST',
    headers: { 'x-api-key': NEXO_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// GET /f/:slug → renderiza el formulario
app.get('/f/:slug', async (req, res) => {
  try {
    const r = await nexoGet(`/api/public-forms/${req.params.slug}`);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      return res.status(r.status).send(renderError(d.message || 'Formulario no disponible.', r.status));
    }
    const { evento, formularioConfig } = await r.json();
    res.send(renderForm(req.params.slug, evento, formularioConfig));
  } catch (err) {
    console.error('[GET /f/:slug]', err.message);
    res.status(500).send(renderError('Error al cargar el formulario.'));
  }
});

// POST /f/:slug → reenvía inscripción a NEXO
app.post('/f/:slug', async (req, res) => {
  try {
    const b = req.body || {};

    // Extraer respuestas de campos personalizados (prefijo resp_)
    const respuestas = {};
    for (const key of Object.keys(b)) {
      if (key.startsWith('resp_')) respuestas[key.slice(5)] = b[key];
    }

    const payload = {
      nombre:   b.nombre,
      apellido: b.apellido,
      cedula:   b.cedula,
      email:    b.email,
      telefono: b.telefono,
      cargo:    b.cargo,
      empresa:  b.empresa,
      nit:      b.nit,
      tipoAfiliacionDeclarada: b.tipoAfiliacionDeclarada,
      respuestas,
      consentimiento: b.consentimiento_autorizado === 'on'
        ? { autorizado: true, version: b.consentimiento_version }
        : undefined,
    };

    const r = await nexoPost(`/api/public-forms/${req.params.slug}/inscripciones`, payload);
    const d = await r.json().catch(() => ({}));

    if (!r.ok) {
      // Re-carga config y re-renderiza el formulario con el error y los valores anteriores
      const cfgR = await nexoGet(`/api/public-forms/${req.params.slug}`);
      if (cfgR.ok) {
        const { evento, formularioConfig } = await cfgR.json();
        return res.status(r.status).send(
          renderForm(req.params.slug, evento, formularioConfig, d.message || 'No se pudo registrar la inscripción.', b)
        );
      }
      return res.status(r.status).send(renderError(d.message || 'No se pudo registrar la inscripción.', r.status));
    }

    res.send(renderConfirmacion(d.codigo, d.mensaje));
  } catch (err) {
    console.error('[POST /f/:slug]', err.message);
    res.status(500).send(renderError('Error al procesar la inscripción.'));
  }
});

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

const PORT = process.env.PORT || 5050;
app.listen(PORT, () => console.log(`Satélite corriendo en http://localhost:${PORT}`));
