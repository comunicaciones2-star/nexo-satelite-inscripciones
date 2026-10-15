require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { renderForm }               = require('./views/renderForm');
const { renderConfirmacion }       = require('./views/renderConfirmacion');
const { renderError }              = require('./views/renderError');
const { renderFormPatrocinador }   = require('./views/renderFormPatrocinador');
const { renderEncuesta, renderGracias } = require('./views/renderEncuesta');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(require('./vendeConVentaja'));

const NEXO_URL     = process.env.NEXO_URL     || 'http://localhost:5000';
const NEXO_API_KEY = process.env.NEXO_API_KEY || '';

async function nexoGet(path) {
  return fetch(`${NEXO_URL}${path}`, {
    headers: { 'x-api-key': NEXO_API_KEY },
  });
}

async function nexoPost(path, body, logo) {
  let contenido = JSON.stringify(body);
  const headers = { 'x-api-key': NEXO_API_KEY };
  if (logo) {
    contenido = new FormData();
    contenido.append('datos', JSON.stringify(body));
    contenido.append('logoEmpresa', new Blob([logo.buffer], { type: logo.mimetype }), logo.originalname);
  } else {
    headers['Content-Type'] = 'application/json';
  }
  return fetch(`${NEXO_URL}${path}`, {
    method: 'POST',
    headers,
    body: contenido,
  });
}

const uploadLogoCafe = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 + 1, files: 1, fields: 30, fieldSize: 10000, parts: 32 },
  fileFilter(req, file, cb) {
    cb(/\.(ai|eps|pdf|svg|png)$/i.test(file.originalname) ? null : new Error('Formato no permitido.'), true);
  },
}).single('logoEmpresa');

function recibirLogoCafe(req, res, next) {
  if (req.params.slug !== 'cafe-y-comercio-2026' || req.path.startsWith('/interesados/')) return next();
  uploadLogoCafe(req, res, async err => {
    if (!err && req.file?.size > 25 * 1024 * 1024) err = { code: 'LIMIT_FILE_SIZE' };
    if (!err) return next();
    const message = 'Adjunta un logo .ai, .eps, .pdf, .svg o .png de máximo 25 MB. Vuelve a seleccionar el archivo.';
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    try {
      const r = await nexoGet(`/api/public-forms/${req.params.slug}`);
      if (r.ok) {
        const { evento, formularioConfig } = await r.json();
        return res.status(status).send(renderForm(req.params.slug, evento, formularioConfig, message, req.body || {}));
      }
    } catch {}
    res.status(status).send(renderError(message, status));
  });
}

// GET /barrios?municipio=X → proxy del catálogo de barrios AMB (mismo origen, sin CORS)
app.get('/barrios', async (req, res) => {
  try {
    const municipio = String(req.query.municipio || '');
    const r = await nexoGet(`/api/public/barrios?municipio=${encodeURIComponent(municipio)}`);
    const d = await r.json().catch(() => []);
    res.status(r.ok ? 200 : r.status).json(Array.isArray(d) ? d : []);
  } catch (err) {
    console.error('[GET /barrios]', err.message);
    res.status(500).json([]);
  }
});

// GET /f/:slug → renderiza el formulario
app.get(['/f/:slug', '/interesados/:slug'], async (req, res) => {
  try {
    const interesados = req.path.startsWith('/interesados/');
    const suffix = interesados ? '/interesados' : '';
    const r = await nexoGet(`/api/public-forms/${req.params.slug}${suffix}`);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      return res.status(r.status).send(renderError(d.message || 'Formulario no disponible.', r.status));
    }
    const { evento, formularioConfig } = await r.json();
    const canal = ['qr', 'manychat'].includes(req.query.canal) ? req.query.canal : '';
    res.send(renderForm(req.params.slug, evento, formularioConfig, null, { canal, interesados }));
  } catch (err) {
    console.error('[GET /f/:slug]', err.message);
    res.status(500).send(renderError('Error al cargar el formulario.'));
  }
});

// POST /f/:slug → reenvía inscripción a NEXO
app.post(['/f/:slug', '/interesados/:slug'], recibirLogoCafe, async (req, res) => {
  try {
    const b = req.body || {};
    const interesados = req.path.startsWith('/interesados/');

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
      // Combobox de barrio guiado por el catálogo AMB (ver docs/spec_input_barrio_controlado.md).
      // Campos dedicados (no van dentro de "respuestas"): el CRM los usa para fijar
      // la comuna en origen cuando eligió del catálogo, o geocodificar de respaldo.
      barrioId:           b.barrioId || undefined,
      comuna:             b.comuna || undefined,
      barrioNoCatalogado: b.barrioNoCatalogado === 'true',
      respuestas,
      // Un checkbox por clave de consentimiento (bracket notation: consentimientos[clave]=on,
      // el body-parser urlencoded con extended:true lo arma como objeto). El servidor de NEXO
      // estampa textoMostrado/version/fechaHora/ip — aquí solo se manda { clave, aceptado }.
      consentimientos: Object.entries(b.consentimientos || {}).map(([clave, v]) => ({ clave, aceptado: v === 'on' })),
    };

    const r = await nexoPost(`/api/public-forms/${req.params.slug}/${interesados ? 'interesados' : 'inscripciones'}`, payload, req.file);
    const d = await r.json().catch(() => ({}));

    if (!r.ok) {
      // Re-carga config y re-renderiza el formulario con el error y los valores anteriores
      const cfgR = await nexoGet(`/api/public-forms/${req.params.slug}${interesados ? '/interesados' : ''}`);
      if (cfgR.ok) {
        const { evento, formularioConfig } = await cfgR.json();
        return res.status(r.status).send(
          renderForm(req.params.slug, evento, formularioConfig, d.message || 'No se pudo registrar la inscripción.', { ...b, interesados })
        );
      }
      return res.status(r.status).send(renderError(d.message || 'No se pudo registrar la inscripción.', r.status));
    }

    res.send(renderConfirmacion(d.codigo, d.mensaje, d.tipoRegistro, d.pendientePago));
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

// ── Encuestas (anónimas o identificadas) ──────────────────────────────

// GET /e/:slug → renderiza la encuesta
app.get('/e/:slug', async (req, res) => {
  try {
    const r = await nexoGet(`/api/public-encuestas/${encodeURIComponent(req.params.slug)}`);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(r.status).send(renderError(d.message || 'Encuesta no disponible.', r.status));
    res.send(renderEncuesta(req.params.slug, d.encuesta, null));
  } catch (err) {
    console.error('[GET /e/:slug]', err.message);
    res.status(500).send(renderError('Error al cargar la encuesta.'));
  }
});

// POST /e/:slug → reenvía las respuestas a NEXO
app.post('/e/:slug', async (req, res) => {
  try {
    const b = req.body || {};
    const respuestas = {};
    const otros = {};
    for (const key of Object.keys(b)) {
      if (key.startsWith('resp_')) respuestas[key.slice(5)] = b[key];
      else if (key.startsWith('otro_') && String(b[key] || '').trim()) otros[key.slice(5)] = b[key];
    }
    // El texto de "Otro" solo cuenta si esa opción quedó marcada.
    for (const clave of Object.keys(otros)) {
      if (![].concat(respuestas[clave] || []).includes('__otro__')) delete otros[clave];
    }

    const r = await nexoPost(`/api/public-encuestas/${encodeURIComponent(req.params.slug)}`, {
      respuestas, otros,
      respondiente: { nombre: b.nombre, empresa: b.empresa, nit: b.nit },
    });
    const d = await r.json().catch(() => ({}));

    if (!r.ok) {
      if (r.status === 400) {
        const cfgR = await nexoGet(`/api/public-encuestas/${encodeURIComponent(req.params.slug)}`);
        if (cfgR.ok) {
          const { encuesta } = await cfgR.json();
          return res.status(400).send(renderEncuesta(req.params.slug, encuesta, d.message, b));
        }
      }
      return res.status(r.status).send(renderError(d.message || 'No se pudo registrar tu respuesta.', r.status));
    }
    res.send(renderGracias());
  } catch (err) {
    console.error('[POST /e/:slug]', err.message);
    res.status(500).send(renderError('Error al procesar tu respuesta.'));
  }
});

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

const PORT = process.env.PORT || 5050;
if (require.main === module) {
  app.listen(PORT, process.env.HOST || '0.0.0.0', () => console.log(`Satélite corriendo en http://localhost:${PORT}`));
  if (process.env.LANDING_PORT) app.listen(Number(process.env.LANDING_PORT), '127.0.0.1', () => console.log(`Landing: http://127.0.0.1:${process.env.LANDING_PORT}/vende-con-ventaja.html`));
}
module.exports = app;
