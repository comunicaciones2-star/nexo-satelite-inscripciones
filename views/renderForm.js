const { layout, esc } = require('./layout');

const INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#280071]/30';
const SELECT_CLS = INPUT + ' bg-white';

// ── Tipos que mapean directamente a campos del Inscrito ──────────────
const TIPOS_INPUT = {
  texto:    'text',
  parrafo:  null,  // textarea
  email:    'email',
  telefono: 'tel',
  numero:   'number',
  fecha:    'date',
};

function label(etiqueta, requerido) {
  return `<label class="block text-sm font-medium text-gray-700 mb-1">${esc(etiqueta)}${requerido ? ' <span class="text-red-500">*</span>' : ''}</label>`;
}

// ── Render de un campo unificado (nuevo schema) ─────────────────────
function renderCampo(campo, prevData) {
  const mapaA = campo.mapaA || '';
  const inputName = (mapaA && mapaA !== 'respuestas') ? mapaA : `resp_${campo.clave}`;
  const req = !!campo.requerido;
  const prevVal = prevData[inputName] || '';

  if (campo.tipo === 'seccion') {
    return `<div class="pt-2">
      <p class="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-1">${esc(campo.etiqueta || '')}</p>
      ${campo.descripcion ? `<p class="text-xs text-gray-500 mt-1">${esc(campo.descripcion)}</p>` : ''}
    </div>`;
  }

  if (campo.tipo === 'habeas_data') {
    const texto = campo.descripcion || '';
    if (!texto) return '';
    return `<div class="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
      <p class="text-xs text-gray-600 leading-relaxed">${esc(texto)}</p>
      <label class="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
        <input type="checkbox" name="consentimiento_autorizado" value="on"
          ${prevData.consentimiento_autorizado === 'on' ? 'checked' : ''}
          ${req ? 'required' : ''} class="mt-0.5">
        <span>Autorizo el tratamiento de mis datos personales${req ? ' <span class="text-red-500">*</span>' : ''}</span>
      </label>
      <input type="hidden" name="consentimiento_version" value="${esc(prevData.consentimiento_version || '')}">
    </div>`;
  }

  if (campo.tipo === 'afiliacion') {
    const prev = prevData.tipoAfiliacionDeclarada || 'no_afiliado';
    return `<div>
      <p class="block text-sm font-medium text-gray-700 mb-2">${esc(campo.etiqueta || '¿Cuál es tu vínculo con Fenalco Santander?')}${req ? ' <span class="text-red-500">*</span>' : ''}</p>
      <div class="flex flex-col gap-2">
        ${[{ v: 'no_afiliado', l: 'No soy afiliado' }, { v: 'afiliado', l: 'Soy afiliado' }, { v: 'emprendedor', l: 'Soy emprendedor' }].map(o =>
          `<label class="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="radio" name="tipoAfiliacionDeclarada" value="${o.v}" ${prev === o.v ? 'checked' : ''}>
            ${o.l}
          </label>`).join('')}
      </div>
    </div>`;
  }

  if (campo.tipo === 'select' && campo.opciones?.length) {
    const opts = campo.opciones.map(o =>
      `<option value="${esc(o)}" ${prevVal === o ? 'selected' : ''}>${esc(o)}</option>`
    ).join('');
    return `<div>${label(campo.etiqueta, req)}
      <select name="${inputName}" ${req ? 'required' : ''} class="${SELECT_CLS}">
        <option value="">Seleccionar…</option>${opts}
      </select></div>`;
  }

  if (campo.tipo === 'radio' && campo.opciones?.length) {
    return `<div>
      ${label(campo.etiqueta, req)}
      <div class="flex flex-col gap-2 mt-1">
        ${campo.opciones.map(o => `
          <label class="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="radio" name="${inputName}" value="${esc(o)}" ${prevVal === o ? 'checked' : ''} ${req ? 'required' : ''}>
            ${esc(o)}
          </label>`).join('')}
      </div>
    </div>`;
  }

  if (campo.tipo === 'casillas' && campo.opciones?.length) {
    const prevVals = Array.isArray(prevVal) ? prevVal : (prevVal ? [prevVal] : []);
    return `<div>
      ${label(campo.etiqueta, req)}
      <div class="flex flex-col gap-2 mt-1">
        ${campo.opciones.map(o => `
          <label class="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" name="${inputName}" value="${esc(o)}" ${prevVals.includes(o) ? 'checked' : ''}>
            ${esc(o)}
          </label>`).join('')}
      </div>
    </div>`;
  }

  if (campo.tipo === 'parrafo') {
    return `<div>${label(campo.etiqueta, req)}
      <textarea name="${inputName}" rows="3" ${req ? 'required' : ''}
        placeholder="${esc(campo.placeholder || '')}"
        class="${INPUT}">${esc(prevVal)}</textarea></div>`;
  }

  // texto, email, telefono, numero, fecha → <input>
  const inputType = TIPOS_INPUT[campo.tipo] || 'text';
  return `<div>${label(campo.etiqueta, req)}
    <input type="${inputType}" name="${inputName}" value="${esc(prevVal)}"
      ${req ? 'required' : ''} placeholder="${esc(campo.placeholder || '')}"
      class="${INPUT}"></div>`;
}

// ── Render con nuevo schema (camposFormulario) ───────────────────────
function renderFormNuevo(slug, evento, cfg, errorMsg, prevData) {
  const { encabezado, descripcion, camposFormulario = [], mensajeConfirmacion } = cfg;

  const fechaEvento = evento.fechaInicio
    ? new Date(evento.fechaInicio).toLocaleDateString('es-CO', {
        day: '2-digit', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota',
      })
    : '';

  const fields = camposFormulario.map(c => renderCampo(c, prevData)).join('\n');

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
    ${fields}
    <button type="submit"
      class="w-full bg-[#280071] hover:bg-[#1e0054] text-white font-semibold py-3 rounded-lg text-sm transition-colors">
      Inscribirme →
    </button>
  </form>
</div>`;

  return layout(encabezado || evento.nombre || 'Inscripción', body);
}

// ── Render con schema viejo (backward compat) ───────────────────────
function renderFormLegacy(slug, evento, cfg, errorMsg, prevData) {
  const {
    encabezado, descripcion,
    campos = {}, preguntaAfiliacion = {},
    camposPersonalizados = [], habeasData = {},
  } = cfg;

  const fechaEvento = evento.fechaInicio
    ? new Date(evento.fechaInicio).toLocaleDateString('es-CO', {
        day: '2-digit', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota',
      })
    : '';

  function stdField(key, lbl, type = 'text') {
    const f = campos[key] || {};
    if (!f.visible) return '';
    const req = !!f.requerido;
    return `<div>
      <label class="block text-sm font-medium text-gray-700 mb-1">
        ${esc(lbl)}${req ? ' <span class="text-red-500">*</span>' : ''}
      </label>
      <input type="${type}" name="${esc(key)}" value="${esc(prevData[key] || '')}"
        ${req ? 'required' : ''} class="${INPUT}">
    </div>`;
  }

  const nitField = campos.empresa?.visible
    ? `<div>
        <label class="block text-sm font-medium text-gray-700 mb-1">NIT de la empresa</label>
        <input type="text" name="nit" value="${esc(prevData.nit || '')}" class="${INPUT}"
          placeholder="Opcional — para verificar afiliación">
      </div>` : '';

  const customFields = camposPersonalizados.map(c => {
    const name = `resp_${esc(c.clave)}`;
    const req = !!c.requerido;
    const lbl = `<label class="block text-sm font-medium text-gray-700 mb-1">
      ${esc(c.etiqueta || c.clave)}${req ? ' <span class="text-red-500">*</span>' : ''}
    </label>`;
    const prev = prevData[`resp_${c.clave}`] || '';

    if (c.tipo === 'select' && c.opciones?.length) {
      const opts = c.opciones.map(o =>
        `<option value="${esc(o)}" ${prev === o ? 'selected' : ''}>${esc(o)}</option>`
      ).join('');
      return `<div>${lbl}<select name="${name}" ${req ? 'required' : ''} class="${SELECT_CLS}">
        <option value="">Seleccionar…</option>${opts}</select></div>`;
    }
    if (c.tipo === 'checkbox') {
      return `<div><label class="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
        <input type="checkbox" name="${name}" value="on" ${prev === 'on' ? 'checked' : ''} ${req ? 'required' : ''}>
        <span>${esc(c.etiqueta || c.clave)}${req ? ' <span class="text-red-500">*</span>' : ''}</span>
      </label></div>`;
    }
    return `<div>${lbl}<input type="text" name="${name}" value="${esc(prev)}"
      ${req ? 'required' : ''} class="${INPUT}"></div>`;
  }).join('\n');

  const afiliacionField = preguntaAfiliacion?.visible
    ? `<div>
        <p class="block text-sm font-medium text-gray-700 mb-2">¿Cuál es tu vínculo con Fenalco Santander?</p>
        <div class="flex flex-col gap-2">
          ${[{ v: 'no_afiliado', l: 'No soy afiliado' }, { v: 'afiliado', l: 'Soy afiliado' }, { v: 'emprendedor', l: 'Soy emprendedor' }]
            .map(o => `<label class="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="radio" name="tipoAfiliacionDeclarada" value="${o.v}"
                ${(prevData.tipoAfiliacionDeclarada || 'no_afiliado') === o.v ? 'checked' : ''}>
              ${o.l}</label>`).join('')}
        </div>
      </div>` : '';

  const habeasField = habeasData?.texto
    ? `<div class="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
        <p class="text-xs text-gray-600 leading-relaxed">${esc(habeasData.texto)}</p>
        <label class="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" name="consentimiento_autorizado" value="on"
            ${prevData.consentimiento_autorizado === 'on' ? 'checked' : ''}
            ${habeasData.requerido ? 'required' : ''} class="mt-0.5">
          <span>Autorizo el tratamiento de mis datos personales${habeasData.requerido ? ' <span class="text-red-500">*</span>' : ''}</span>
        </label>
        <input type="hidden" name="consentimiento_version" value="${esc(habeasData.version || '')}">
      </div>` : '';

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
      <label class="block text-sm font-medium text-gray-700 mb-1">Nombre <span class="text-red-500">*</span></label>
      <input type="text" name="nombre" value="${esc(prevData.nombre || '')}" required class="${INPUT}">
    </div>
    ${stdField('apellido', 'Apellido')}
    ${stdField('cedula', 'Cédula')}
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
      <input type="email" name="email" value="${esc(prevData.email || '')}" class="${INPUT}">
    </div>
    ${stdField('telefono', 'Teléfono', 'tel')}
    ${stdField('cargo', 'Cargo')}
    ${stdField('empresa', 'Empresa')}
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

// ── Punto de entrada público ────────────────────────────────────────
function renderForm(slug, evento, cfg, errorMsg = null, prevData = {}) {
  const usarNuevo = cfg.camposFormulario && cfg.camposFormulario.length > 0;
  return usarNuevo
    ? renderFormNuevo(slug, evento, cfg, errorMsg, prevData)
    : renderFormLegacy(slug, evento, cfg, errorMsg, prevData);
}

module.exports = { renderForm };
