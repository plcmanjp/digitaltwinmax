// Local-only QA. Synthetic cases never enter the deployed /docs directory.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { cases } = require('./fixtures.cjs');
const { mediaCases, fixtureSVG } = require('./media-fixtures.cjs');
const root = path.resolve(__dirname, '../docs');
const releaseCases = [...Object.keys(cases), 'rate-limit', 'offline', 'http-error'];
const allowedCases = [...releaseCases, ...Object.keys(mediaCases)];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.vtt': 'text/vtt', '.mp4': 'video/mp4' };
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:4173');
  const headers = { 'Cache-Control': 'no-store' };
  const send = (body, type = 'text/javascript') => res.writeHead(200, { ...headers, 'Content-Type': `${type}; charset=utf-8` }).end(body);
  if (url.pathname === '/test-fixture.js') {
    const name = url.searchParams.get('case');
    if (!allowedCases.includes(name)) { res.writeHead(404).end(); return; }
    const errorCode = { 'rate-limit': 'rate-limit', offline: 'network', 'http-error': 'http' }[name];
    const body = mediaCases[name]
      ? `window.DTM_MEDIA=${JSON.stringify(mediaCases[name])};window.DTMReleases={...window.DTMReleases,loadTrial:async()=>({state:'empty'})};`
      : errorCode
        ? `window.DTMReleases={...window.DTMReleases,loadTrial:async()=>{throw new window.DTMReleases.ReleaseError(${JSON.stringify(errorCode)})}};`
        : `window.DTMReleases={...window.DTMReleases,loadTrial:async()=>window.DTMReleases.selectTrial(${JSON.stringify(cases[name])})};`;
    send(body); return;
  }
  const image = /^\/assets\/fixture-([123])\.svg$/.exec(url.pathname);
  if (image) { send(fixtureSVG(Number(image[1])), 'image/svg+xml'); return; }
  if (url.pathname === '/assets/fixture-ko.vtt') { send('WEBVTT\n\n00:00.000 --> 00:06.000\n로컬 재생 테스트입니다. 실제 제품 영상이 아닙니다.\n', 'text/vtt'); return; }
  if (url.pathname === '/assets/fixture-description.txt') { send('LOCAL TEST ONLY: six seconds of a neutral grey background. No product footage.', 'text/plain'); return; }
  if (url.pathname === '/assets/fixture-video.mp4') {
    const video = path.join(__dirname, '.generated/fixture.mp4');
    if (!fs.existsSync(video)) { res.writeHead(404).end('Run node tests/generate-media-fixture.cjs first.'); return; }
    const body = fs.readFileSync(video);
    res.writeHead(200, { ...headers, 'Content-Type': 'video/mp4', 'Content-Length': body.length }).end(body); return;
  }
  const scenario = url.pathname.startsWith('/preview/') ? url.pathname.slice('/preview/'.length) : null;
  if (scenario && !allowedCases.includes(scenario)) { res.writeHead(404).end(); return; }
  let requestPath;
  try { requestPath = scenario || url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, ''); }
  catch { res.writeHead(400).end(); return; }
  const filename = path.resolve(root, requestPath);
  if (!filename.startsWith(root + path.sep) || !fs.existsSync(filename) || !fs.statSync(filename).isFile()) { res.writeHead(404).end(); return; }
  let body = fs.readFileSync(filename);
  if (scenario) {
    body = body.toString('utf8').replace('<head>', '<head><base href="/">')
      .replace('<script src="site.js" defer></script>', '')
      .replace('<script src="trial.js" defer></script>', `<script src="test-fixture.js?case=${scenario}" defer></script><script src="site.js" defer></script><script src="trial.js" defer></script>`)
      .replace('<body id="top">', `<body id="top"><p style="padding:12px;background:#f8e899;color:#171717;text-align:center;font:14px sans-serif">LOCAL TEST: ${scenario} · 실제 제품/배포 자료가 아닙니다</p>`);
  }
  send(body, types[path.extname(filename)] || 'application/octet-stream');
}).listen(4173, '127.0.0.1', () => {
  console.log('Local preview: http://127.0.0.1:4173');
  console.log(`Fixtures: ${allowedCases.map(name => `/preview/${name}`).join(', ')}`);
});
