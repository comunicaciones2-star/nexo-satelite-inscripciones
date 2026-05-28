// Utilidades compartidas de renderizado HTML
const esc = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function layout(title, body) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${esc(title)} — Fenalco Santander</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="min-h-screen bg-gray-50 py-8 px-4">
  <div class="max-w-lg mx-auto">
    <div class="mb-6 text-center">
      <span class="inline-block bg-[#280071] text-white text-sm font-bold px-5 py-2 rounded-lg tracking-wide">
        Fenalco Santander
      </span>
    </div>
    ${body}
    <p class="text-center text-xs text-gray-400 mt-6">
      Fenalco Santander · Plataforma de eventos
    </p>
  </div>
</body>
</html>`;
}

module.exports = { layout, esc };
