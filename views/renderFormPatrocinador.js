const { layout, esc } = require('./layout');

const INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#280071]/30';
const SELECT_CLS = INPUT + ' bg-white';

function renderFormPatrocinador(slug, evento, formularioConfig, nivelesPatrocinio, errorMsg, prevData) {
  const cfg      = formularioConfig || {};
  const niveles  = nivelesPatrocinio || [];
  const prevType = prevData.esEmpresa === 'false' ? 'persona' : 'empresa';

  const fechaEvento = evento.fechaInicio
    ? new Date(evento.fechaInicio).toLocaleDateString('es-CO', {
        day: '2-digit', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota',
      })
    : '';

  const errorHtml = errorMsg
    ? `<div class="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">${esc(errorMsg)}</div>`
    : '';

  const nivelesOpts = niveles.length
    ? niveles
        .sort((a, b) => (a.orden || 0) - (b.orden || 0))
        .map(n => {
          const label = n.nombre + (n.monto ? ` — $${Number(n.monto).toLocaleString('es-CO')}` : '') + (n.descripcion ? ` (${n.descripcion})` : '');
          return `<option value="${esc(n.nombre)}" ${prevData.nivelInteres === n.nombre ? 'selected' : ''}>${esc(label)}</option>`;
        })
        .join('')
    : '';

  const habeasHtml = cfg.habeasData?.texto
    ? `<div class="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
        <p class="text-xs text-gray-600 leading-relaxed">${esc(cfg.habeasData.texto)}</p>
        <label class="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" name="consentimiento_autorizado" value="on"
            ${prevData.consentimiento_autorizado === 'on' ? 'checked' : ''}
            ${cfg.habeasData.requerido ? 'required' : ''} class="mt-0.5">
          <span>Autorizo el tratamiento de mis datos personales${cfg.habeasData.requerido ? ' <span class="text-red-500">*</span>' : ''}</span>
        </label>
        <input type="hidden" name="consentimiento_version" value="${esc(cfg.habeasData.version || '')}">
      </div>`
    : '';

  const body = `
<div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
  <div>
    <div class="inline-flex items-center gap-1.5 bg-[#280071]/10 text-[#280071] text-xs font-semibold px-3 py-1 rounded-full mb-3">
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>
      Formulario de patrocinadores
    </div>
    <h1 class="text-xl font-bold text-[#280071]">${esc(cfg.encabezado || evento.nombre)}</h1>
    ${cfg.descripcion ? `<p class="text-sm text-gray-500 mt-2">${esc(cfg.descripcion)}</p>` : ''}
    ${fechaEvento || evento.lugar ? `
    <div class="flex flex-wrap gap-2 mt-3">
      ${fechaEvento ? `<span class="text-xs text-gray-500 bg-gray-50 border border-gray-100 px-3 py-1 rounded-full">📅 ${esc(fechaEvento)}</span>` : ''}
      ${evento.lugar ? `<span class="text-xs text-gray-500 bg-gray-50 border border-gray-100 px-3 py-1 rounded-full">📍 ${esc(evento.lugar)}</span>` : ''}
    </div>` : ''}
  </div>

  ${errorHtml}

  <form method="POST" action="/patrocinador/${esc(slug)}" class="space-y-5" id="formPatr">

    <!-- Tipo de registro -->
    <div>
      <p class="text-sm font-semibold text-gray-700 mb-2">Tipo de registro <span class="text-red-500">*</span></p>
      <div class="flex gap-2">
        <label class="flex-1 cursor-pointer">
          <input type="radio" name="esEmpresa" value="true" class="sr-only peer" ${prevType !== 'persona' ? 'checked' : ''} onchange="toggleTipo(this)">
          <div class="border-2 rounded-xl p-3 text-center text-sm font-medium transition-all peer-checked:border-[#280071] peer-checked:bg-[#280071]/5 peer-checked:text-[#280071] border-gray-200 text-gray-500 hover:border-gray-300">
            <svg class="w-5 h-5 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
            Empresa
          </div>
        </label>
        <label class="flex-1 cursor-pointer">
          <input type="radio" name="esEmpresa" value="false" class="sr-only peer" ${prevType === 'persona' ? 'checked' : ''} onchange="toggleTipo(this)">
          <div class="border-2 rounded-xl p-3 text-center text-sm font-medium transition-all peer-checked:border-[#280071] peer-checked:bg-[#280071]/5 peer-checked:text-[#280071] border-gray-200 text-gray-500 hover:border-gray-300">
            <svg class="w-5 h-5 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
            Persona natural
          </div>
        </label>
      </div>
    </div>

    <!-- Datos empresa -->
    <div id="secEmpresa" ${prevType === 'persona' ? 'style="display:none"' : ''} class="space-y-3 border-t border-gray-100 pt-4">
      <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Datos de la empresa</p>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Razón social <span class="text-red-500">*</span></label>
        <input type="text" name="razonSocial" value="${esc(prevData.razonSocial || '')}" class="${INPUT}" placeholder="Nombre comercial o razón social">
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">NIT</label>
          <input type="text" name="nit" value="${esc(prevData.nit || '')}" class="${INPUT}" placeholder="000000000-0">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Sector</label>
          <input type="text" name="sector" value="${esc(prevData.sector || '')}" class="${INPUT}" placeholder="Retail, Alimentos…">
        </div>
      </div>
    </div>

    <!-- Datos persona natural -->
    <div id="secPersona" ${prevType !== 'persona' ? 'style="display:none"' : ''} class="space-y-3 border-t border-gray-100 pt-4">
      <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Datos personales</p>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Nombre <span class="text-red-500">*</span></label>
          <input type="text" name="nombre" value="${esc(prevData.nombre || '')}" class="${INPUT}">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Apellido <span class="text-red-500">*</span></label>
          <input type="text" name="apellido" value="${esc(prevData.apellido || '')}" class="${INPUT}">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Cédula</label>
          <input type="text" name="cedula" value="${esc(prevData.cedula || '')}" class="${INPUT}">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Sector</label>
          <input type="text" name="sector" value="${esc(prevData.sector || '')}" class="${INPUT}" placeholder="Retail, Alimentos…">
        </div>
      </div>
    </div>

    <!-- Datos de contacto -->
    <div class="space-y-3 border-t border-gray-100 pt-4">
      <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Datos de contacto</p>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Nombre <span class="text-red-500">*</span></label>
          <input type="text" name="contactoNombre" value="${esc(prevData.contactoNombre || '')}" required class="${INPUT}">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Apellido</label>
          <input type="text" name="contactoApellido" value="${esc(prevData.contactoApellido || '')}" class="${INPUT}">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Cargo</label>
          <input type="text" name="contactoCargo" value="${esc(prevData.contactoCargo || '')}" class="${INPUT}">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
          <input type="tel" name="contactoTelefono" value="${esc(prevData.contactoTelefono || '')}" class="${INPUT}">
        </div>
        <div class="col-span-2">
          <label class="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
          <input type="email" name="contactoEmail" value="${esc(prevData.contactoEmail || '')}" class="${INPUT}">
        </div>
      </div>
    </div>

    <!-- Interés de patrocinio -->
    <div class="space-y-3 border-t border-gray-100 pt-4">
      <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Interés de patrocinio</p>
      ${nivelesOpts ? `
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Nivel de interés</label>
        <select name="nivelInteres" class="${SELECT_CLS}">
          <option value="">— Seleccionar —</option>
          ${nivelesOpts}
          <option value="Por definir" ${prevData.nivelInteres === 'Por definir' ? 'selected' : ''}>Por definir / Quiero más información</option>
        </select>
      </div>` : ''}
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">¿Cómo conoció este evento?</label>
        <select name="comoConocio" class="${SELECT_CLS}">
          <option value="">— Seleccionar —</option>
          ${['Redes sociales','Correo electrónico','Un aliado o conocido','Fenalco Santander me contactó','Otro']
            .map(o => `<option value="${esc(o)}" ${prevData.comoConocio === o ? 'selected' : ''}>${esc(o)}</option>`)
            .join('')}
        </select>
      </div>
    </div>

    ${habeasHtml}

    <button type="submit"
      class="w-full bg-[#280071] hover:bg-[#1e0054] text-white font-semibold py-3 rounded-lg text-sm transition-colors">
      Enviar solicitud de patrocinio →
    </button>
  </form>
</div>

<script>
function toggleTipo(el) {
  const esEmpresa = el.value === 'true';
  document.getElementById('secEmpresa').style.display = esEmpresa ? '' : 'none';
  document.getElementById('secPersona').style.display = esEmpresa ? 'none' : '';
}
</script>`;

  return layout(cfg.encabezado || evento.nombre || 'Patrocinadores', body);
}

module.exports = { renderFormPatrocinador };
