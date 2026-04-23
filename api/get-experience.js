const { kv } = require('@vercel/kv');

module.exports = async function handler(req, res) {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing id' });

  try {
    const blobUrl = await kv.get(id);
    if (!blobUrl) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(410).send(expiredHtml());
    }
    return res.redirect(302, blobUrl);
  } catch (err) {
    console.error('get-experience error:', err);
    return res.status(500).json({ error: err.message });
  }
};

function expiredHtml() {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Enlace expirado · Lookiar</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0a0a0f;color:#f0f0f5;font-family:system-ui,sans-serif;min-height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:32px;gap:20px}
.logo-mark{width:40px;height:40px;background:linear-gradient(135deg,#6366f1,#a78bfa);border-radius:10px;display:grid;place-items:center;font-weight:700;font-size:18px;color:#fff;margin:0 auto}
.icon{width:64px;height:64px;background:rgba(244,63,94,.1);border:1px solid rgba(244,63,94,.2);border-radius:50%;display:grid;place-items:center;color:#f43f5e;margin:0 auto}
h1{font-size:22px;font-weight:700}
p{color:#8b8ba0;font-size:14px;max-width:300px;line-height:1.6}
a{display:inline-block;background:linear-gradient(135deg,#6366f1,#a78bfa);color:#fff;text-decoration:none;border-radius:12px;padding:12px 28px;font-size:15px;font-weight:600}
</style>
</head>
<body>
<div class="logo-mark">L</div>
<div class="icon">
<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
</div>
<h1>Este enlace expiró</h1>
<p>El código QR tiene una vigencia de 1 hora. Vuelve a la herramienta para generar uno nuevo.</p>
<a href="/">Crear nueva experiencia AR</a>
</body>
</html>`;
}
