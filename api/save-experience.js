const { put } = require('@vercel/blob');
const Redis = require('ioredis');
const { randomBytes } = require('crypto');

const TTL_SECONDS = 3600;

let redis;
function getRedis() {
  if (!redis) redis = new Redis(process.env.REDIS_URL, { tls: { rejectUnauthorized: false } });
  return redis;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { html } = req.body || {};
  if (!html || typeof html !== 'string') {
    return res.status(400).json({ error: 'Missing html' });
  }

  const id = 'exp-' + randomBytes(6).toString('hex');
  console.log('save-experience: id=%s html.length=%d', id, html.length);

  try {
    const blob = await put('experiences/' + id + '.html', html, {
      access: 'public',
      contentType: 'text/html; charset=utf-8',
    });
    console.log('save-experience: blob uploaded', blob.url);

    const expiresAt = Date.now() + TTL_SECONDS * 1000;

    const client = getRedis();
    await client.set(id, JSON.stringify({ blobUrl: blob.url, expiresAt }), 'EX', TTL_SECONDS);
    console.log('save-experience: redis set ok');

    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host  = req.headers['x-forwarded-host']  || req.headers.host;
    const shortUrl = proto + '://' + host + '/?experience=' + id;

    return res.json({ id, shortUrl, expiresAt });
  } catch (err) {
    console.error('save-experience error:', err);
    return res.status(500).json({ error: err.message });
  }
};
