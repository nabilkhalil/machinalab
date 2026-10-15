// Minimal static file server for site/ (local preview and Playwright tests).
// Replaces `python -m http.server`, whose 5-connection listen backlog refused or stalled
// connections when several test browsers loaded pages at once.
//
// Usage: node tools/serve.js [port] [dir]   (defaults: 8000, site)
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const port = Number(process.argv[2] || 8000);
const root = path.resolve(process.argv[3] || 'site');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { pathname = '/'; }
  if (pathname.endsWith('/')) pathname += 'index.html';
  const file = path.join(root, pathname);
  // Never serve anything outside site/ (path traversal).
  if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403).end('Forbidden'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
});

server.listen(port, '127.0.0.1', 511, () => console.log(`Serving ${root} at http://127.0.0.1:${port}/`));
