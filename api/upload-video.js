const { put } = require('@vercel/blob');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const contentType = req.headers['content-type'] || 'video/mp4';
  if (!contentType.startsWith('video/')) {
    return res.status(400).json({ error: 'Expected video content-type' });
  }

  const filename = 'videos/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.mp4';

  try {
    console.log('upload-video: uploading', filename, 'content-type:', contentType);

    const blob = await put(filename, req, {
      access: 'public',
      contentType: contentType,
    });

    console.log('upload-video: done', blob.url);
    return res.json({ videoUrl: blob.url });
  } catch (err) {
    console.error('upload-video error:', err);
    return res.status(500).json({ error: err.message });
  }
};
