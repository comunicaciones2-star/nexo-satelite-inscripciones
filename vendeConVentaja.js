'use strict';
const express = require('express');
const path = require('node:path');
const router = express.Router();
const SLUG = 'vende-con-ventaja-2026';
const root = path.resolve(__dirname, '../fenalco-santander-landings');

// La API key permanece en el servidor, como en /api/registro de NDLM.
router.all('/api/vende-con-ventaja/:tipo', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (!['interesado', 'participante'].includes(req.params.tipo)) return res.status(404).json({ message: 'Formulario no disponible.' });
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ message: 'Método no permitido.' });
  if (req.method === 'POST' && !req.is('application/json')) return res.status(415).json({ message: 'Formato no permitido.' });
  if (req.get('origin')) {
    try { if (new URL(req.get('origin')).host !== req.get('host')) throw new Error('Origen'); }
    catch { return res.status(403).json({ message: 'Origen no permitido.' }); }
  }
  const suffix = req.params.tipo === 'interesado' ? '/interesados' : (req.method === 'POST' ? '/inscripciones' : '');
  try {
    let body;
    if (req.method === 'POST') {
      const input = req.body || {};
      if (input.website) return res.status(400).json({ message: 'No se pudo enviar el formulario.' });
      body = Object.fromEntries(['nombre', 'email', 'telefono', 'empresa', 'cargo'].map(k => [k, input[k]]));
      body.respuestas = { tipoParticipante: input.tipoParticipante };
      body.consentimientos = [{ clave: 'tratamiento_datos', aceptado: input.consentimiento === true }];
    }
    const upstream = await fetch(`${process.env.NEXO_URL || 'http://localhost:5000'}/api/public-forms/${SLUG}${suffix}`, {
      method: req.method,
      headers: { 'x-api-key': process.env.NEXO_API_KEY || '', 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(60000),
    });
    const data = await upstream.json();
    if (!upstream.ok) return res.status(upstream.status).json({ message: data.message || 'No se pudo procesar la solicitud.' });
    if (req.method === 'GET') {
      const fields = data.formularioConfig?.camposFormulario || [];
      const consent = fields.find(c => c.clave === 'tratamiento_datos' && c.tipo === 'habeas_data');
      if (!consent?.descripcion) return res.status(503).json({ message: 'Formulario temporalmente no disponible.' });
      return res.json({ consentimiento: consent.descripcion, opciones: fields.find(c => c.clave === 'tipoParticipante')?.opciones || [] });
    }
    return res.status(upstream.status).json({ mensaje: data.mensaje, correoEnviado: data.correoEnviado, tipoRegistro: data.tipoRegistro });
  } catch { return res.status(503).json({ message: 'No se pudo conectar con el registro. Tus datos siguen en el formulario; intenta de nuevo.' }); }
});
router.get('/vende-con-ventaja.html', (_req, res) => res.sendFile(path.join(root, 'vende-con-ventaja.html')));
router.use('/vende-con-ventaja', express.static(path.join(root, 'vende-con-ventaja'), { maxAge: 0 }));
module.exports = router;
