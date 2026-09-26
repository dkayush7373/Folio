// ─── Folio Combined Localhost Server ──────────────────────────────────
// Serves both the built frontend application and the backend API
// on a single unified localhost port. Zero external runtime dependencies.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.join(__dirname, 'dist');
const PORT = process.env.PORT || 5000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
};

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  // 1. Health check endpoint
  if (req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', server: 'Folio Combined Localhost', port: PORT }));
    return;
  }

  // 2. AI Generate endpoint
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
            res.writeHead(apiRes.status, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `Gemini API error: ${apiRes.statusText}` }));
            return;
          }

          const data = await apiRes.json();
          const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ content }));
          return;
        }

        // When no key is set on server, acknowledge so client uses local extraction
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'ok',
          message: 'No server GEMINI_API_KEY configured. Client local intelligence active.',
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 3. Static files from dist
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  let pathname = parsedUrl.pathname;
  if (pathname === '/') pathname = '/index.html';

  let filePath = path.join(DIST_DIR, pathname);

  // If path doesn't exist, fallback to index.html (SPA routing)
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, 'index.html');
  }

  if (fs.existsSync(filePath)) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found. Please run `npm run build` first.');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`  Folio Combined Localhost Server is Live!`);
  console.log(`  > Local:   http://localhost:${PORT}`);
  console.log(`  > Network: http://127.0.0.1:${PORT}`);
  console.log(`  Frontend & API are unified on the same origin.`);
  console.log(`======================================================\n`);
});
