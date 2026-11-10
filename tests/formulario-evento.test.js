const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const vm = require('node:vm');
const { renderFormEvento } = require('../views/renderFormEvento');

const ES_EMPRESA = { clave: 'tipoParticipante', valor: 'empresa' };
const formulario = {
  codigo: 'inscripcion-webinar', proposito: 'inscripcion',
  campos: [
    { clave: 'tipoParticipante', etiqueta: 'Tipo de participante', tipo: 'radio', requerido: true, mapaA: '', opciones: ['empresa', 'persona_natural'], etiquetasOpciones: { empresa: 'Empresa', persona_natural: 'Persona natural' } },
    { clave: 'nombre', etiqueta: 'Nombres y apellidos', tipo: 'texto', requerido: true, mapaA: 'nombre' },
    { clave: 'cedula', etiqueta: 'Cédula', tipo: 'numero', requerido: true, mapaA: 'cedula', minDigitos: 5, maxDigitos: 10 },
    { clave: 'empresa', etiqueta: 'Nombre de la empresa', tipo: 'texto', requerido: false, mapaA: 'empresa', visibleSi: ES_EMPRESA, requeridoSi: ES_EMPRESA },
    { clave: 'nit', etiqueta: 'NIT', tipo: 'numero', requerido: false, mapaA: '', visibleSi: ES_EMPRESA, requeridoSi: ES_EMPRESA, normalizar: 'nit', maxDigitos: 10 },
    { clave: 'tratamiento_datos', etiqueta: 'Autorizo', tipo: 'habeas_data', requerido: true, mapaA: '', descripcion: 'Texto <a href="https://x.test">política</a>' },
  ],
};
const evento = { nombre: 'Webinar Tributario', fechaInicio: '2026-11-23T14:00:00.000Z', modalidad: 'virtual' };
const slug = 'webinar-optimizacion-tributaria-2026';

let backend, satellite, base, recibido;
const listen = (app) => new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });

before(async () => {
  const api = express();
  api.use(express.json());
  api.get('/api/public-forms/:slug/formularios/:codigo', (req, res) => res.json({ evento, formulario }));
  api.post('/api/public-forms/:slug/formularios/:codigo', (req, res) => { recibido = req.body; res.status(201).json({ id: 'x', codigo: 'EVT-SECRETO' }); });
  backend = await listen(api);
  process.env.NEXO_URL = `http://127.0.0.1:${backend.address().port}`;
  process.env.NEXO_API_KEY = 'clave-solo-prueba';
  satellite = await listen(require('../server'));
  base = `http://127.0.0.1:${satellite.address().port}`;
});
after(async () => { await Promise.all([backend, satellite].map((s) => new Promise((r) => s.close(r)))); });

test('renderiza radio con etiquetas, reglas condicionales y consentimiento con enlace', () => {
  const html = renderFormEvento(slug, 'inscripcion-webinar', evento, formulario, null, {});
  assert.match(html, /Persona natural/);
  assert.match(html, /name="resp_tipoParticipante"/);
  assert.match(html, /data-visible-si=/);
  assert.match(html, /name="resp_nit"/);
  assert.match(html, /name="consentimientos\[tratamiento_datos\]"[^>]*required/);
  assert.match(html, /<a href="https:\/\/x\.test">política<\/a>/);
  assert.ok(!html.includes('EVT-'));
});

test('el script oculta y deshabilita empresa/NIT para persona natural y los exige para empresa', () => {
  const html = renderFormEvento(slug, 'inscripcion-webinar', evento, formulario, null, {});
  const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).find((s) => s.includes('aplicar'));
  const mk = (clave, ds) => ({ dataset: ds, style: {}, querySelector: () => null, querySelectorAll: () => [inputs[clave]] });
  const inputs = { empresa: { disabled: false, required: false }, nit: { disabled: false, required: false } };
  const bloques = [
    mk('empresa', { visibleSi: JSON.stringify(ES_EMPRESA), requeridoSi: JSON.stringify(ES_EMPRESA) }),
    mk('nit', { visibleSi: JSON.stringify(ES_EMPRESA), requeridoSi: JSON.stringify(ES_EMPRESA) }),
  ];
  let seleccion = 'persona_natural';
  const form = {
    addEventListener() {},
    querySelector: (sel) => (sel.includes('resp_tipoParticipante') && sel.includes(':checked') ? { value: seleccion } : null),
    querySelectorAll: () => bloques,
  };
  const correr = () => vm.runInNewContext(script, { document: { getElementById: () => form } });
  correr();
  assert.equal(bloques[0].style.display, 'none');
  assert.equal(inputs.nit.disabled, true);
  assert.equal(inputs.nit.required, false);
  seleccion = 'empresa';
  correr();
  assert.equal(bloques[1].style.display, '');
  assert.equal(inputs.nit.disabled, false);
  assert.equal(inputs.nit.required, true);
});

test('GET /f/:slug/:codigo sirve el formulario; POST reenvía el payload armado desde la definición', async () => {
  const g = await fetch(`${base}/f/${slug}/inscripcion-webinar`);
  assert.equal(g.status, 200);
  assert.match(await g.text(), /Webinar Tributario/);

  const body = new URLSearchParams({
    resp_tipoParticipante: 'empresa', nombre: 'Ana Ríos', cedula: '1098765432', empresa: 'XYZ SAS', resp_nit: '900.159.756-1',
    'consentimientos[tratamiento_datos]': 'on',
  });
  const res = await fetch(`${base}/f/${slug}/inscripcion-webinar`, { method: 'POST', body, headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /Inscripción registrada/);
  assert.ok(!html.includes('EVT-SECRETO') && !html.includes('clave-solo-prueba'));
  assert.deepEqual(recibido, {
    respuestas: { tipoParticipante: 'empresa', nit: '900.159.756-1' },
    nombre: 'Ana Ríos', cedula: '1098765432', empresa: 'XYZ SAS',
    consentimientos: [{ clave: 'tratamiento_datos', aceptado: true }],
  });
});
