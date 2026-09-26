import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

function combinedApiPlugin(): Plugin {
  return {
    name: 'combined-api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url === '/api/health') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ status: 'ok', server: 'Folio Combined Vite Localhost' }));
          return;
        }

        if (req.url === '/api/generate' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => { body += chunk; });
          req.on('end', async () => {
            try {
              const { prompt, apiKey } = JSON.parse(body || '{}');
              const key = apiKey || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

              if (key) {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`;
                const apiRes = await fetch(url, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
                });

                if (!apiRes.ok) {
                  res.statusCode = apiRes.status;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: `Gemini API error: ${apiRes.statusText}` }));
                  return;
                }

                const data = await apiRes.json();
                const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ content }));
                return;
              }

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                status: 'ok',
                message: 'No server GEMINI_API_KEY configured. Client-side intelligence active.',
              }));
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        next();
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), combinedApiPlugin()],
  optimizeDeps: {
    include: ['pdfjs-dist'],
  },
})
