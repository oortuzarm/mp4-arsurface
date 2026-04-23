const { handleUpload } = require('@vercel/blob/client');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const jsonResponse = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async (pathname) => ({
        allowedContentTypes: ['video/mp4'],
        maximumSizeInBytes: 100 * 1024 * 1024,
        tokenPayload: pathname,
      }),
      onUploadCompleted: async ({ blob }) => {
        console.log('Video uploaded:', blob.url);
      },
    });
    return res.json(jsonResponse);
  } catch (err) {
    console.error('upload-token error:', err);
    return res.status(500).json({ error: err.message });
  }
};
