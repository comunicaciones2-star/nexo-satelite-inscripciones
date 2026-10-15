const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const multer = require('multer');
const vm = require('node:vm');
const { renderForm } = require('../views/renderForm');
let backend, satellite, base, recibido;
const cfg = { habilitado: true, camposFormulario: [{ clave: 'nombre', mapaA: 'nombre', etiqueta: 'Nombre', requerido: true, tipo: 'texto' }] };
const evento = { nombre: 'Café & Comercio' };
const slug = 'cafe-y-comercio-2026';
const listen = app => new Promise(resolve => { const server = app.listen(0, '127.0.0.1', () => resolve(server)); });

before(async () => {
  const api = express();
  api.get('/api/public-forms/:slug', (req, res) => res.json({ evento, formularioConfig: cfg }));
  api.post('/api/public-forms/:slug/inscripciones', multer().single('logoEmpresa'), (req, res) => {
    recibido = { archivo: req.file, datos: JSON.parse(req.body.datos), key: req.get('x-api-key') };
    res.status(201).json({ codigo: 'PRUEBA-LOGO', mensaje: 'Inscripción y logo recibidos.' });
  });
  backend = await listen(api);
  process.env.NEXO_URL = `http://127.0.0.1:${backend.address().port}`;
  process.env.NEXO_API_KEY = 'clave-solo-prueba';
  satellite = await listen(require('../server'));
  base = `http://127.0.0.1:${satellite.address().port}`;
});
after(async () => { await Promise.all([backend, satellite].filter(Boolean).map(s => new Promise(resolve => s.close(resolve)))); });

test('campo requerido, formatos, límite y validación inmediata; otros eventos no cambian', () => {
  const html = renderForm(slug, evento, cfg, null, {});
  assert.match(html, /enctype="multipart\/form-data"/);
  assert.match(html, /type="file" required accept=".ai,.eps,.pdf,.svg,.png"/);
  assert.match(html, /máx. 25 MB/);
  assert.ok(!renderForm('otro-evento', evento, cfg, null, {}).includes('name="logoEmpresa"'));
  const handlers = {};
  let validation;
  const input = { files: [], addEventListener: (name, fn) => handlers[name] = fn, setCustomValidity: e => validation = e, setAttribute() {} };
  const estado = {};
  const form = { addEventListener() {} };
  const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(s => s.includes("getElementById('logoEmpresa')"));
  vm.runInNewContext(script, { document: { getElementById: id => id === 'logoEmpresa' ? input : id === 'logoEmpresa-estado' ? estado : form } });
  for (const [file, error] of [[{ name: 'logo.png', size: 26 * 1024 * 1024 }, true], [{ name: 'logo.exe', size: 20 }, true], [{ name: 'logo.svg', size: 0 }, true], [{ name: 'logo.AI', size: 25 * 1024 * 1024 }, false]]) {
    input.files = [file]; handlers.change(); assert.equal(Boolean(validation), error);
  }
});

test('envía archivo y datos al backend conservando la autorización y la clave fuera del navegador', async () => {
  const data = new FormData();
  data.append('nombre', 'Empresa de prueba');
  data.append('email', 'prueba@example.com');
  data.append('consentimientos[tratamiento_datos]', 'on');
  data.append('logoEmpresa', new Blob(['%PDF-1.7\nlogo'], { type: 'application/pdf' }), 'empresa.ai');
  const res = await fetch(`${base}/f/${slug}`, { method: 'POST', body: data });
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /PRUEBA-LOGO/);
  assert.ok(!html.includes('clave-solo-prueba'));
  assert.equal(recibido.archivo.originalname, 'empresa.ai');
  assert.equal(recibido.archivo.buffer.toString(), '%PDF-1.7\nlogo');
  assert.equal(recibido.datos.nombre, 'Empresa de prueba');
  assert.deepEqual(recibido.datos.consentimientos, [{ clave: 'tratamiento_datos', aceptado: true }]);
  assert.equal(recibido.key, 'clave-solo-prueba');
});

test('rechaza archivo mayor de 25 MB y conserva los campos escritos', async () => {
  const data = new FormData();
  data.append('nombre', 'Nombre que se conserva');
  data.append('logoEmpresa', new Blob([Buffer.alloc(25 * 1024 * 1024 + 1)]), 'grande.png');
  const res = await fetch(`${base}/f/${slug}`, { method: 'POST', body: data });
  assert.equal(res.status, 413);
  const html = await res.text();
  assert.match(html, /máximo 25 MB/);
  assert.match(html, /Nombre que se conserva/);
});

test('acepta un archivo de exactamente 25 MB', async () => {
  const data = new FormData();
  data.append('nombre', 'Empresa límite');
  data.append('logoEmpresa', new Blob([Buffer.alloc(25 * 1024 * 1024)]), 'limite.png');
  const res = await fetch(`${base}/f/${slug}`, { method: 'POST', body: data });
  assert.equal(res.status, 200);
  await res.text();
  assert.equal(recibido.archivo.size, 25 * 1024 * 1024);
});
