const { put } = require('@vercel/blob');
const { kv } = require('@vercel/kv');
const { randomBytes } = require('crypto');

const TTL_SECONDS = 3600;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { html } = req.body || {};
  if (!html || typeof html !== 'string') {
    return res.status(400).json({ error: 'Missing html' });
  }

  const id = 'exp-' + randomBytes(6).toString('hex');

  try {
    const blob = await put('experiences/' + id + '.html', html, {
      access: 'public',
      contentType: 'text/html; charset=utf-8',
    });

    await kv.set(id, blob.url, { ex: TTL_SECONDS });

    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host  = req.headers['x-forwarded-host']  || req.headers.host;
    const shortUrl  = proto + '://' + host + '/?experience=' + id;
    const expiresAt = Date.now() + TTL_SECONDS * 1000;

    return res.json({ id, shortUrl, expiresAt });
  } catch (err) {
    console.error('save-experience error:', err);
    return res.status(500).json({ error: err.message });
  }
};
