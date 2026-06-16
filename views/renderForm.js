const { layout, esc } = require('./layout');

const INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#280071]/30';

function renderForm(slug, evento, cfg, errorMsg = null, prevData = {}) {
  const {
    encabezado,
    descripcion,
    campos = {},
    preguntaAfiliacion = {},
    camposPersonalizados = [],
    habeasData = {},
  } = cfg;

  const fechaEvento = evento.fechaInicio
    ? new Date(evento.fechaInicio).toLocaleDateString('es-CO', {
        day: '2-digit', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
        timeZone: 'America/Bogota',
      })
    : '';

  // ── Campo estándar configurable ──────────────────────────────
  function stdField(key, label, type = 'text') {
    const f = campos[key] || {};
    if (!f.visible) return '';
    const req = !!f.requerido;
    return `
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          ${esc(label)}${req ? ' <span class="text-red-500">*</span>' : ''}
        </label>
        <input type="${type}" name="${esc(key)}" value="${esc(prevData[key] || '')}"
          ${req ? 'required' : ''} class="${INPUT}">
      </div>`;
  }

  // NIT acompaña a empresa para el match de afiliado en NEXO
  const nitField = (campos.empresa?.visible)
    ? `<div>
        <label class="block text-sm font-medium text-gray-700 mb-1">NIT de la empresa</label>
        <input type="text" name="nit" value="${esc(prevData.nit || '')}" class="${INPUT}"
          placeholder="Opcional — para verificar afiliación">
      </div>`
    : '';

  // ── Campos personalizados ────────────────────────────────────
  const customFields = camposPersonalizados.map((c) => {
    const name = `resp_${esc(c.clave)}`;
    const req = !!c.requerido;
    const label = `<label class="block text-sm font-medium text-gray-700 mb-1">
      ${esc(c.etiqueta || c.clave)}${req ? ' <span class="text-red-500">*</span>' : ''}
    </label>`;
    const prev = prevData[`resp_${c.clave}`] || '';

    if (c.tipo === 'select' && c.opciones?.length) {
      const opts = c.opciones.map((o) =>
        `<option value="${esc(o)}" ${prev === o ? 'selected' : ''}>${esc(o)}</option>`
      ).join('');
      return `<div>${label}<select name="${name}" ${req ? 'required' : ''} class="${INPUT}">
        <option value="">Seleccionar…</option>${opts}</select></div>`;
    }

    if (c.tipo === 'checkbox') {
      return `<div><label class="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
        <input type="checkbox" name="${name}" value="on" ${prev === 'on' ? 'checked' : ''} ${req ? 'required' : ''}>
        <span>${esc(c.etiqueta || c.clave)}${req ? ' <span class="text-red-500">*</span>' : ''}</span>
      </label></div>`;
    }

    return `<div>${label}<input type="text" name="${name}" value="${esc(prev)}"
      ${req ? 'required' : ''} class="${INPUT}"></div>`;
  }).join('\n');

  // ── Pregunta de afiliación ───────────────────────────────────
  const afiliacionField = preguntaAfiliacion?.visible
    ? `<div>
        <p class="block text-sm font-medium text-gray-700 mb-2">¿Cuál es tu vínculo con Fenalco Santander?</p>
        <div class="flex flex-col gap-2">
          ${[
            { v: 'no_afiliado', l: 'No soy afiliado' },
            { v: 'afiliado',    l: 'Soy afiliado' },
            { v: 'emprendedor', l: 'Soy emprendedor' },
          ].map((o) => `
          <label class="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="radio" name="tipoAfiliacionDeclarada" value="${o.v}"
              ${(prevData.tipoAfiliacionDeclarada || 'no_afiliado') === o.v ? 'checked' : ''}>
            ${o.l}
          </label>`).join('')}
        </div>
      </div>`
    : '';

  // ── Habeas data ──────────────────────────────────────────────
  const habeasField = habeasData?.texto
    ? `<div class="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
        <p class="text-xs text-gray-600 leading-relaxed">${esc(habeasData.texto)}</p>
        <label class="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" name="consentimiento_autorizado" value="on"
            ${prevData.consentimiento_autorizado === 'on' ? 'checked' : ''}
            ${habeasData.requerido ? 'required' : ''} class="mt-0.5">
          <span>Autorizo el tratamiento de mis datos personales
            ${habeasData.requerido ? '<span class="text-red-500">*</span>' : ''}
          </span>
        </label>
        <input type="hidden" name="consentimiento_version" value="${esc(habeasData.version || '')}">
      </div>`
    : '';

  const errorHtml = errorMsg
    ? `<div class="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">${esc(errorMsg)}</div>`
    : '';

  const body = `
<div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">

  <div>
    <h1 class="text-xl font-bold text-[#280071]">${esc(encabezado || evento.nombre)}</h1>
    ${descripcion ? `<p class="text-sm text-gray-500 mt-1">${esc(descripcion)}</p>` : ''}
    ${fechaEvento || evento.lugar ? `
    <div class="flex flex-wrap gap-2 mt-3">
      ${fechaEvento ? `<span class="text-xs text-gray-500 bg-gray-50 border border-gray-100 px-3 py-1 rounded-full">📅 ${esc(fechaEvento)}</span>` : ''}
      ${evento.lugar ? `<span class="text-xs text-gray-500 bg-gray-50 border border-gray-100 px-3 py-1 rounded-full">📍 ${esc(evento.lugar)}</span>` : ''}
    </div>` : ''}
  </div>

  ${errorHtml}

  <form method="POST" action="/f/${esc(slug)}" class="space-y-4">

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">
        Nombre <span class="text-red-500">*</span>
      </label>
      <input type="text" name="nombre" value="${esc(prevData.nombre || '')}" required class="${INPUT}">
    </div>

    ${stdField('apellido',  'Apellido')}
    ${stdField('cedula',    'Cédula')}

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
      <input type="email" name="email" value="${esc(prevData.email || '')}" class="${INPUT}">
    </div>

    ${stdField('telefono',  'Teléfono',  'tel')}
    ${stdField('cargo',     'Cargo')}
    ${stdField('empresa',   'Empresa')}
    ${nitField}

    ${customFields}
    ${afiliacionField}
    ${habeasField}

    <button type="submit"
      class="w-full bg-[#280071] hover:bg-[#1e0054] text-white font-semibold py-3 rounded-lg text-sm transition-colors">
      Inscribirme →
    </button>

  </form>
</div>`;

  return layout(encabezado || evento.nombre || 'Inscripción', body);
}

module.exports = { renderForm };
