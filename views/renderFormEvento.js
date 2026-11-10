// Formulario declarativo por evento (formularios[] del CRM): GET/POST /f/:slug/:codigo.
// Renderiza la definición que entrega NEXO (GET /api/public-forms/:slug/formularios/:codigo),
// con campos condicionales (visibleSi / requeridoSi). La regla vive en el CRM, que es la
// fuente de verdad y la vuelve a validar y a descartar en el servidor: aquí solo se
// replica para que la persona no vea campos que no le aplican.
const { layout, esc } = require('./layout');

const INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#280071]/30';
const TIPOS_INPUT = { texto: 'text', email: 'email', telefono: 'tel', numero: 'text', fecha: 'date' };

const nombreInput = (campo) => (campo.mapaA && campo.mapaA !== 'respuestas' ? campo.mapaA : `resp_${campo.clave}`);

// data-* con la regla condicional; el script de abajo la evalúa en el navegador.
function atributosCondicionales(campo) {
  const a = [];
  if (campo.visibleSi) a.push(`data-visible-si='${esc(JSON.stringify(campo.visibleSi))}'`);
  if (campo.requeridoSi) a.push(`data-requerido-si='${esc(JSON.stringify(campo.requeridoSi))}'`);
  if (campo.etiquetaSi) a.push(`data-etiqueta-si='${esc(JSON.stringify(campo.etiquetaSi))}'`);
  if (campo.requerido) a.push('data-requerido-fijo="1"');
  return a.join(' ');
}

function renderCampo(campo, prev) {
  const name = nombreInput(campo);
  const prevVal = prev[name] || '';
  const req = !!campo.requerido;
  const estrella = req ? ' <span class="text-red-500">*</span>' : '';

  if (campo.tipo === 'habeas_data') {
    if (!campo.descripcion) return '';
    const checked = prev.consentimientos?.[campo.clave] === 'on';
    // descripcion viene del catálogo del CRM (texto legal controlado, con <a>): se inserta tal cual.
    return `<div class="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
      <p class="text-xs text-gray-600 leading-relaxed">${campo.descripcion}</p>
      <label class="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
        <input type="checkbox" name="consentimientos[${esc(campo.clave)}]" value="on" ${checked ? 'checked' : ''} ${req ? 'required' : ''} class="mt-0.5">
        <span>${esc(campo.etiqueta || 'Autorizo el tratamiento de mis datos personales')}${estrella}</span>
      </label>
    </div>`;
  }

  if (campo.tipo === 'radio') {
    const etiquetas = campo.etiquetasOpciones || {};
    const opciones = (campo.opciones || []).map((o) => `<label class="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
        <input type="radio" name="${esc(name)}" value="${esc(o)}" ${prevVal === o ? 'checked' : ''} ${req ? 'required' : ''}>
        ${esc(etiquetas[o] || o)}
      </label>`).join('');
    return `<div data-campo="${esc(campo.clave)}" ${atributosCondicionales(campo)}>
      <p class="block text-sm font-medium text-gray-700 mb-2">${esc(campo.etiqueta)}${estrella}</p>
      <div class="flex flex-col gap-2">${opciones}</div></div>`;
  }

  if (campo.tipo === 'select') {
    const opts = (campo.opciones || []).map((o) => `<option value="${esc(o)}" ${prevVal === o ? 'selected' : ''}>${esc(o)}</option>`).join('');
    return `<div data-campo="${esc(campo.clave)}" ${atributosCondicionales(campo)}>
      <label class="block text-sm font-medium text-gray-700 mb-1"><span data-etiqueta>${esc(campo.etiqueta)}</span><span data-estrella>${estrella}</span></label>
      <select name="${esc(name)}" ${req ? 'required' : ''} class="${INPUT} bg-white"><option value="">Seleccionar…</option>${opts}</select></div>`;
  }

  const tipo = TIPOS_INPUT[campo.tipo] || 'text';
  const patron = campo.maxDigitos ? `inputmode="numeric" maxlength="${campo.normalizar === 'nit' ? 14 : (campo.normalizar === 'celular_co' ? 16 : campo.maxDigitos)}"` : '';
  return `<div data-campo="${esc(campo.clave)}" ${atributosCondicionales(campo)}>
    <label class="block text-sm font-medium text-gray-700 mb-1"><span data-etiqueta>${esc(campo.etiqueta)}</span><span data-estrella>${estrella}</span></label>
    <input type="${tipo}" name="${esc(name)}" value="${esc(prevVal)}" ${req ? 'required' : ''} ${patron} class="${INPUT}" autocomplete="off">
  </div>`;
}

// Replica en el navegador visibleSi / requeridoSi / etiquetaSi. Sin JS el formulario
// muestra todo y el servidor igual descarta lo que no aplica.
const SCRIPT_CONDICIONAL = `
(function () {
  var form = document.getElementById('form-evento');
  function valorDe(clave) {
    var el = form.querySelector('[name="resp_' + clave + '"]:checked') || form.querySelector('[name="' + clave + '"]:checked');
    if (el) return el.value;
    var t = form.querySelector('[name="resp_' + clave + '"]') || form.querySelector('[name="' + clave + '"]');
    return t && t.type !== 'radio' ? t.value : '';
  }
  function cumple(r) {
    var v = String(valorDe(r.clave) || '').trim();
    return [].concat(r.valor).map(String).indexOf(v) !== -1;
  }
  function aplicar() {
    form.querySelectorAll('[data-campo]').forEach(function (bloque) {
      var visible = bloque.dataset.visibleSi ? cumple(JSON.parse(bloque.dataset.visibleSi)) : true;
      var requerido = visible && (bloque.dataset.requeridoFijo === '1' || (bloque.dataset.requeridoSi ? cumple(JSON.parse(bloque.dataset.requeridoSi)) : false));
      bloque.style.display = visible ? '' : 'none';
      bloque.querySelectorAll('input,select').forEach(function (i) { i.disabled = !visible; i.required = requerido; });
      var estrella = bloque.querySelector('[data-estrella]');
      if (estrella) estrella.innerHTML = requerido ? ' <span class="text-red-500">*</span>' : '';
      if (bloque.dataset.etiquetaSi) {
        var e = JSON.parse(bloque.dataset.etiquetaSi);
        var texto = e.valores[valorDe(e.clave)];
        var span = bloque.querySelector('[data-etiqueta]');
        if (texto && span) span.textContent = texto;
      }
    });
  }
  form.addEventListener('change', aplicar);
  aplicar();
})();`;

function fechaTexto(fecha) {
  if (!fecha) return '';
  return new Date(fecha).toLocaleString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Bogota',
  });
}

function renderFormEvento(slug, codigo, evento, formulario, error, prev = {}) {
  const campos = (formulario.campos || []).filter((c) => c.tipo !== 'seccion');
  const cuerpo = `
<div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
  <div>
    <h1 class="text-xl font-bold text-[#280071]">${esc(evento.nombre)}</h1>
    <p class="text-sm text-gray-500 mt-1">${esc(fechaTexto(evento.fechaInicio))}${evento.modalidad === 'virtual' ? ' · Virtual' : ''}</p>
  </div>
  ${error ? `<div role="alert" class="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">${esc(error)}</div>` : ''}
  <form id="form-evento" method="POST" action="/f/${encodeURIComponent(slug)}/${encodeURIComponent(codigo)}" class="space-y-4">
    ${campos.map((c) => renderCampo(c, prev)).join('\n    ')}
    <button type="submit" class="w-full bg-[#280071] text-white font-semibold rounded-lg py-2.5 text-sm hover:bg-[#1d0055]">Inscribirme</button>
  </form>
</div>
<script>${SCRIPT_CONDICIONAL}</script>`;
  return layout(evento.nombre, cuerpo);
}

// Confirmación propia: el webinar no emite código QR ni se presenta en puerta.
function renderConfirmacionEvento(evento) {
  const virtual = evento.modalidad === 'virtual';
  return layout('Inscripción registrada', `
<div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center space-y-5">
  <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
    <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
  </div>
  <h1 class="text-xl font-bold text-[#280071]">¡Inscripción registrada!</h1>
  <p class="text-sm text-gray-500">${esc(evento.nombre)}<br>${esc(fechaTexto(evento.fechaInicio))}</p>
  <p class="text-sm text-gray-600">Te enviamos un correo de confirmación${virtual ? ' con el enlace de conexión' : ''}. Si no lo ves, revisa tu carpeta de spam.</p>
</div>`);
}

module.exports = { renderFormEvento, renderConfirmacionEvento };
