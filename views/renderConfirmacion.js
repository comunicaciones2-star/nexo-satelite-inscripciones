const { layout, esc } = require('./layout');

function renderConfirmacion(codigo, mensaje, tipoRegistro, pendientePago) {
  if (['interesado', 'participante'].includes(tipoRegistro)) {
    return layout('Solicitud recibida', `<div class="bg-white rounded-2xl border p-8 text-center space-y-5"><h1 class="text-xl font-bold">${tipoRegistro === 'interesado' ? '¡Gracias por tu interés!' : 'Solicitud de inscripción recibida'}</h1><p>${esc(mensaje || 'Hemos recibido tus datos.')}</p></div>`);
  }

  // Evento de pago sin cobro en sitio ni pasarela en línea todavía: el registro
  // queda pendiente hasta coordinar el pago, así que ni el título ni el código
  // deben insinuar que el cupo ya está asegurado (ver services/emailService.js).
  if (pendientePago) {
    const body = `
<div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center space-y-5">
  <div class="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
    <svg class="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 8v4m0 4h.01M10.29 3.86l-8.18 14.14A2 2 0 0 0 3.82 21h16.36a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    </svg>
  </div>

  <div>
    <h1 class="text-xl font-bold text-[#280071]">Registro recibido — pendiente de pago</h1>
    <p class="text-sm text-gray-500 mt-2">${esc(mensaje || 'Hemos recibido tu registro. Este es un programa pago: tu cupo queda pendiente de confirmar hasta completar el pago.')}</p>
  </div>

  ${codigo ? `
  <div class="bg-[#280071]/5 border border-[#280071]/10 rounded-xl p-5 inline-block">
    <p class="text-xs text-gray-500 mb-1">Tu código de referencia</p>
    <p class="text-3xl font-mono font-bold text-[#280071] tracking-widest">${esc(codigo)}</p>
  </div>` : ''}

  <p class="text-xs text-gray-400">
    Nos pondremos en contacto contigo para coordinar el pago y confirmar tu cupo.
  </p>
</div>`;
    return layout('Registro recibido — pendiente de pago', body);
  }

  const body = `
<div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center space-y-5">
  <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
    <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
    </svg>
  </div>

  <div>
    <h1 class="text-xl font-bold text-[#280071]">¡Inscripción registrada!</h1>
    <p class="text-sm text-gray-500 mt-2">${esc(mensaje || 'Tu inscripción ha sido registrada exitosamente.')}</p>
  </div>

  ${codigo ? `
  <div class="bg-[#280071]/5 border border-[#280071]/10 rounded-xl p-5 inline-block">
    <p class="text-xs text-gray-500 mb-1">Tu código de inscripción</p>
    <p class="text-3xl font-mono font-bold text-[#280071] tracking-widest">${esc(codigo)}</p>
    <p class="text-xs text-gray-400 mt-2">Preséntalo el día del evento</p>
  </div>` : ''}

  <p class="text-xs text-gray-400">
    Si proporcionaste tu correo, recibirás una confirmación con el código QR.
  </p>
</div>`;

  return layout('Inscripción confirmada', body);
}

module.exports = { renderConfirmacion };
