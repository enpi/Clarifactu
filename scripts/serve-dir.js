// Minimal static file server on 127.0.0.1, used by CI as a local mirror for the
// electron-builder toolsets (fetched beforehand with `gh release download`).
// Usage: node scripts/serve-dir.js <dir> [port]
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(process.argv[2] || '.');
const port = Number(process.argv[3] || 47123);

http.createServer((req, res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(req.url.split('?')[0]));
  const ok = file.startsWith(root + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile();
  console.log(`${ok ? 200 : 404} ${req.url}`);
  if (!ok) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Length': fs.statSync(file).size });
  fs.createReadStream(file).pipe(res);
}).listen(port, '127.0.0.1', () => console.log(`serving ${root} on http://127.0.0.1:${port}/`));
