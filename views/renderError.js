const { layout, esc } = require('./layout');

const TITULOS = {
  404: 'Formulario no disponible',
  410: 'Formulario cerrado',
  401: 'Sin acceso',
  500: 'Error del servidor',
};

function renderError(message, statusCode = 500) {
  const titulo = TITULOS[statusCode] || 'Error';

  const body = `
<div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center space-y-4">
  <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
    <svg class="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
        d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
    </svg>
  </div>
  <h1 class="text-xl font-bold text-gray-800">${esc(titulo)}</h1>
  <p class="text-sm text-gray-500">${esc(message)}</p>
</div>`;

  return layout(titulo, body);
}

module.exports = { renderError };
