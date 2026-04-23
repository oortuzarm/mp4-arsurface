const { handleUpload } = require('@vercel/blob/client');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  console.log('upload-token: type=%s', req.body && req.body.type);

  try {
    const jsonResponse = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        console.log('upload-token: generating token for', pathname);
        return {
          allowedContentTypes: ['video/mp4', 'video/quicktime', 'video/mov', 'video/webm'],
          maximumSizeInBytes: 500 * 1024 * 1024,
        };
      },
      onUploadCompleted: async ({ blob }) => {
        console.log('upload-token: completed', blob.url);
      },
    });
    return res.json(jsonResponse);
  } catch (err) {
    console.error('upload-token error:', err);
    return res.status(500).json({ error: err.message });
  }
};
