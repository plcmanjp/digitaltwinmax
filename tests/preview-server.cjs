// Local-only preview. Synthetic cases are never deployed by Pages (/docs only).
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { cases } = require('./fixtures.cjs');
const root = path.resolve(__dirname, '../docs');
const allowedCases = [...Object.keys(cases), 'rate-limit', 'offline', 'http-error'];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:4173');
  const headers = { 'Cache-Control': 'no-store' };
  if (url.pathname === '/test-fixture.js') {
    const name = url.searchParams.get('case');
    if (!allowedCases.includes(name)) { res.writeHead(404).end(); return; }
    const errorCode = { 'rate-limit': 'rate-limit', offline: 'network', 'http-error': 'http' }[name];
    const body = errorCode
      ? `window.DTMReleases={...window.DTMReleases,loadTrial:async()=>{throw new window.DTMReleases.ReleaseError(${JSON.stringify(errorCode)})}};`
      : `window.DTMReleases={...window.DTMReleases,loadTrial:async()=>window.DTMReleases.selectTrial(${JSON.stringify(cases[name])})};`;
    res.writeHead(200, { ...headers, 'Content-Type': 'text/javascript; charset=utf-8' }).end(body);
    return;
  }
  const scenario = url.pathname.startsWith('/preview/') ? url.pathname.slice('/preview/'.length) : null;
  if (scenario && !allowedCases.includes(scenario)) { res.writeHead(404).end(); return; }
  const requestPath = scenario || url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const filename = path.resolve(root, requestPath);
  if (!filename.startsWith(root + path.sep) || !fs.existsSync(filename) || !fs.statSync(filename).isFile()) { res.writeHead(404).end(); return; }
  let body = fs.readFileSync(filename);
  if (scenario) {
    body = body.toString('utf8').replace('<head>', '<head><base href="/">')
      .replace('<script src="trial.js" defer></script>', `<script src="test-fixture.js?case=${scenario}" defer></script><script src="trial.js" defer></script>`)
      .replace('<body>', `<body><p style="padding:12px;background:#d8ef7b;text-align:center">LOCAL TEST FIXTURE: ${scenario} · 실제 배포 파일이 아닙니다</p>`);
  }
  res.writeHead(200, { ...headers, 'Content-Type': `${types[path.extname(filename)] || 'application/octet-stream'}; charset=utf-8` }).end(body);
}).listen(4173, '127.0.0.1', () => {
  console.log('Local preview: http://127.0.0.1:4173');
  console.log(`Fixtures: ${allowedCases.map(name => `/preview/${name}`).join(', ')}`);
});
