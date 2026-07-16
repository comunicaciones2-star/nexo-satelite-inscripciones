require('dotenv').config();
const express = require('express');
const { renderForm }               = require('./views/renderForm');
const { renderConfirmacion }       = require('./views/renderConfirmacion');
const { renderError }              = require('./views/renderError');
const { renderFormPatrocinador }   = require('./views/renderFormPatrocinador');

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
    const canal = ['qr', 'manychat'].includes(req.query.canal) ? req.query.canal : '';
    res.send(renderForm(req.params.slug, evento, formularioConfig, null, { canal }));
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
      canal: ['qr', 'manychat'].includes(b.canal) ? b.canal : undefined,
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

// ── Formulario público de patrocinadores ──────────────────────────────

// GET /patrocinador/:slug → renderiza el formulario de patrocinadores
app.get('/patrocinador/:slug', async (req, res) => {
  try {
    const r = await nexoGet(`/api/public-forms/patrocinadores/${req.params.slug}`);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      return res.status(r.status).send(renderError(d.message || 'Formulario no disponible.', r.status));
    }
    const { evento, formularioConfig, nivelesPatrocinio } = await r.json();
    res.send(renderFormPatrocinador(req.params.slug, evento, formularioConfig, nivelesPatrocinio));
  } catch (err) {
    console.error('[GET /patrocinador/:slug]', err.message);
    res.status(500).send(renderError('Error al cargar el formulario de patrocinadores.'));
  }
});

// POST /patrocinador/:slug → envía el registro a NEXO
app.post('/patrocinador/:slug', async (req, res) => {
  try {
    const b = req.body || {};

    const payload = {
      esEmpresa:        b.esEmpresa !== 'false',
      razonSocial:      b.razonSocial,
      nit:              b.nit,
      nombre:           b.nombre,
      apellido:         b.apellido,
      cedula:           b.cedula,
      sector:           b.sector,
      contactoNombre:   b.contactoNombre,
      contactoApellido: b.contactoApellido,
      contactoCargo:    b.contactoCargo,
      contactoEmail:    b.contactoEmail,
      contactoTelefono: b.contactoTelefono,
      nivelInteres:     b.nivelInteres,
      comoConocio:      b.comoConocio,
      consentimiento:   b.consentimiento_autorizado === 'on'
        ? { autorizado: true, version: b.consentimiento_version }
        : undefined,
    };

    const r = await nexoPost(`/api/public-forms/patrocinadores/${req.params.slug}`, payload);
    const d = await r.json().catch(() => ({}));

    if (!r.ok) {
      const cfgR = await nexoGet(`/api/public-forms/patrocinadores/${req.params.slug}`);
      if (cfgR.ok) {
        const { evento, formularioConfig, nivelesPatrocinio } = await cfgR.json();
        return res.status(r.status).send(
          renderFormPatrocinador(req.params.slug, evento, formularioConfig, nivelesPatrocinio, d.message || 'No se pudo registrar.', b)
        );
      }
      return res.status(r.status).send(renderError(d.message || 'No se pudo registrar.', r.status));
    }

    // Confirmación personalizada para patrocinadores (sin código QR)
    const { layout, esc } = require('./views/layout');
    const msgHTML = layout('¡Solicitud recibida!', `
<div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center space-y-5">
  <div class="w-16 h-16 bg-[#280071]/10 rounded-full flex items-center justify-center mx-auto">
    <svg class="w-8 h-8 text-[#280071]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
    </svg>
  </div>
  <div>
    <h1 class="text-xl font-bold text-[#280071]">¡Solicitud recibida!</h1>
    <p class="text-sm text-gray-500 mt-2">${esc(d.mensaje || '¡Registro recibido! Pronto nos pondremos en contacto.')}</p>
  </div>
  <p class="text-xs text-gray-400">Un ejecutivo de Fenalco Santander se comunicará contigo en los próximos días hábiles.</p>
</div>`);
    res.send(msgHTML);
  } catch (err) {
    console.error('[POST /patrocinador/:slug]', err.message);
    res.status(500).send(renderError('Error al procesar la solicitud.'));
  }
});

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

const PORT = process.env.PORT || 5050;
app.listen(PORT, () => console.log(`Satélite corriendo en http://localhost:${PORT}`));
