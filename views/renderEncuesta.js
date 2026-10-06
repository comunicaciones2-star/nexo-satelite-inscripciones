const { layout, esc } = require('./layout');

const INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#280071]/30';
const VALOR_OTRO = '__otro__';

function label(etiqueta, requerido) {
  return `<label class="block text-sm font-medium text-gray-700 mb-1">${esc(etiqueta)}${requerido ? ' <span class="text-red-500">*</span>' : ''}</label>`;
}

const aLista = (v) => (Array.isArray(v) ? v : v ? [v] : []);

function renderPregunta(p, prev) {
  const name = `resp_${p.clave}`;
  const req = !!p.requerida;
  const val = prev[name];

  if (p.tipo === 'opcion_unica' || p.tipo === 'opcion_multiple') {
    const multiple = p.tipo === 'opcion_multiple';
    const tipoInput = multiple ? 'checkbox' : 'radio';
    const marcadas = aLista(val);
    const opciones = [...p.opciones.map((o) => ({ valor: o, texto: o })), ...(p.permiteOtro ? [{ valor: VALOR_OTRO, texto: 'Otro', otro: true }] : [])];
    return `<div data-pregunta="${esc(p.clave)}">
      ${label(p.etiqueta, req)}
      <div class="flex flex-col gap-2 mt-1">
        ${opciones.map((o) => `
          <label class="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="${tipoInput}" name="${name}" value="${esc(o.valor)}" ${marcadas.includes(o.valor) ? 'checked' : ''} ${req && !multiple ? 'required' : ''} ${o.otro ? 'data-otro' : ''}>
            ${esc(o.texto)}
          </label>`).join('')}
        ${p.permiteOtro ? `<input type="text" name="otro_${esc(p.clave)}" value="${esc(prev['otro_' + p.clave] || '')}" maxlength="300"
          placeholder="Escribe tu respuesta" class="${INPUT} ${marcadas.includes(VALOR_OTRO) ? '' : 'hidden'}" data-otro-texto>` : ''}
      </div>
    </div>`;
  }

  if (p.tipo === 'fecha') {
    return `<div>${label(p.etiqueta, req)}<input type="date" name="${name}" value="${esc(val || '')}" ${req ? 'required' : ''} class="${INPUT}"></div>`;
  }
  if (p.tipo === 'texto_largo') {
    return `<div>${label(p.etiqueta, req)}<textarea name="${name}" rows="4" maxlength="3000" ${req ? 'required' : ''} class="${INPUT}">${esc(val || '')}</textarea></div>`;
  }
  return `<div>${label(p.etiqueta, req)}<input type="text" name="${name}" value="${esc(val || '')}" maxlength="300" ${req ? 'required' : ''} class="${INPUT}"></div>`;
}

function datosRespondiente(prev) {
  const campo = (name, etiqueta) =>
    `<div>${label(etiqueta, true)}<input type="text" name="${name}" value="${esc(prev[name] || '')}" maxlength="200" required class="${INPUT}"></div>`;
  return `<div class="space-y-4">
    <p class="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-1">Tus datos</p>
    ${campo('nombre', 'Nombre completo')}
    ${campo('empresa', 'Empresa')}
    ${campo('nit', 'NIT')}
  </div>`;
}

function renderEncuesta(slug, encuesta, error, prev = {}) {
  const errorHtml = error
    ? `<div class="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">${esc(error)}</div>` : '';

  const body = `
<div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
  <div>
    <h1 class="text-xl font-bold text-[#280071]">${esc(encuesta.titulo)}</h1>
    ${encuesta.descripcion ? `<p class="text-sm text-gray-500 mt-1 whitespace-pre-line">${esc(encuesta.descripcion)}</p>` : ''}
    <p class="text-xs text-gray-400 mt-3">${encuesta.tipo === 'anonima'
      ? '🔒 Esta encuesta es anónima: no se registra ningún dato tuyo.'
      : 'Esta encuesta es identificada: tus datos quedarán asociados a tus respuestas.'}</p>
  </div>
  ${errorHtml}
  <form method="POST" action="/e/${esc(slug)}" class="space-y-5">
    ${encuesta.tipo === 'identificada' ? datosRespondiente(prev) : ''}
    ${encuesta.preguntas.map((p) => renderPregunta(p, prev)).join('')}
    <button type="submit"
      class="w-full bg-[#280071] hover:bg-[#1e0054] text-white font-semibold py-3 rounded-lg text-sm transition-colors">
      Enviar respuestas →
    </button>
  </form>
</div>
<script>
document.querySelectorAll('[data-pregunta]').forEach(function (bloque) {
  var texto = bloque.querySelector('[data-otro-texto]');
  if (!texto) return;
  function sync() {
    var otro = bloque.querySelector('[data-otro]');
    var activo = otro && otro.checked;
    texto.classList.toggle('hidden', !activo);
    texto.required = !!activo;
  }
  bloque.addEventListener('change', sync);
  sync();
});
</script>`;

  return layout(encuesta.titulo, body);
}

function renderGracias(mensaje) {
  return layout('¡Gracias!', `
<div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center space-y-5">
  <div class="w-16 h-16 bg-[#280071]/10 rounded-full flex items-center justify-center mx-auto">
    <svg class="w-8 h-8 text-[#280071]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
    </svg>
  </div>
  <h1 class="text-xl font-bold text-[#280071]">¡Gracias por responder!</h1>
  <p class="text-sm text-gray-500">${esc(mensaje || 'Tu opinión nos ayuda a construir mejores decisiones para el comercio de Santander.')}</p>
</div>`);
}

module.exports = { renderEncuesta, renderGracias };
