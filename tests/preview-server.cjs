// Local-only QA. Synthetic cases never enter the deployed /docs directory.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { cases } = require('./fixtures.cjs');
const { mediaCases, fixtureSVG } = require('./media-fixtures.cjs');
const root = path.resolve(__dirname, '../docs');
const releaseCases = [...Object.keys(cases), 'rate-limit', 'offline', 'http-error'];
const allowedCases = [...releaseCases, ...Object.keys(mediaCases)];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.vtt': 'text/vtt', '.mp4': 'video/mp4' };
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:4173');
  const headers = { 'Cache-Control': 'no-store' };
  const send = (body, type = 'text/javascript') => {
    const contentType = type.startsWith('image/') || type.startsWith('video/') ? type : `${type}; charset=utf-8`;
    res.writeHead(200, { ...headers, 'Content-Type': contentType }).end(body);
  };
  const sendFile = (filename, contentType) => {
    const stat = fs.statSync(filename);
    if (req.headers.range && contentType === 'video/mp4') {
      const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if (match) {
        const start = match[1] ? parseInt(match[1], 10) : 0;
        const end = match[2] ? Math.min(parseInt(match[2], 10), stat.size - 1) : stat.size - 1;
        if (start <= end && start < stat.size) {
          res.writeHead(206, {
            ...headers,
            'Content-Type': contentType,
            'Content-Range': `bytes ${start}-${end}/${stat.size}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': end - start + 1
          });
          fs.createReadStream(filename, { start, end }).pipe(res);
          return;
        }
        res.writeHead(416, { ...headers, 'Content-Range': `bytes */${stat.size}` }).end();
        return;
      }
    }
    res.writeHead(200, { ...headers, 'Content-Type': contentType, 'Accept-Ranges': 'bytes', 'Content-Length': stat.size });
    fs.createReadStream(filename).pipe(res);
  };
  if (url.pathname === '/preview-banner.css' || url.pathname === '/preview/preview-banner.css') {
    send('.local-preview-banner{padding:12px;background:#f8e899;color:#171717;text-align:center;font:14px sans-serif;margin:0}', 'text/css');
    return;
  }
  if (url.pathname === '/test-fixture.js' || url.pathname === '/preview/test-fixture.js') {
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
  const normalizedPath = url.pathname.startsWith('/preview/') && !allowedCases.includes(url.pathname.slice('/preview/'.length))
    ? url.pathname.slice('/preview'.length)
    : url.pathname;
  const image = /^\/assets\/fixture-([123])\.svg$/.exec(normalizedPath);
  if (image) { send(fixtureSVG(Number(image[1])), 'image/svg+xml'); return; }
  if (normalizedPath === '/assets/fixture-ko.vtt') { send('WEBVTT\n\n00:00.000 --> 00:06.000\n로컬 재생 테스트입니다. 실제 제품 영상이 아닙니다.\n', 'text/vtt'); return; }
  if (normalizedPath === '/assets/fixture-description.txt') { send('LOCAL TEST ONLY: six seconds of a neutral grey background. No product footage.', 'text/plain'); return; }
  if (normalizedPath === '/assets/fixture-video.mp4') {
    const video = path.join(__dirname, '.generated/fixture.mp4');
    if (!fs.existsSync(video)) { res.writeHead(404).end('Run node tests/generate-media-fixture.cjs first.'); return; }
    sendFile(video, 'video/mp4'); return;
  }
  const scenario = url.pathname.startsWith('/preview/') && allowedCases.includes(url.pathname.slice('/preview/'.length))
    ? url.pathname.slice('/preview/'.length)
    : null;
  let requestPath;
  try { requestPath = scenario || normalizedPath === '/' ? 'index.html' : decodeURIComponent(normalizedPath).replace(/^\/+/, ''); }
  catch { res.writeHead(400).end(); return; }
  const filename = path.resolve(root, requestPath);
  if (!filename.startsWith(root + path.sep) || !fs.existsSync(filename) || !fs.statSync(filename).isFile()) { res.writeHead(404).end(); return; }
  const contentType = types[path.extname(filename)] || 'application/octet-stream';
  if (!scenario) {
    if (contentType === 'video/mp4') { sendFile(filename, contentType); return; }
    send(fs.readFileSync(filename), contentType);
    return;
  }
  const body = fs.readFileSync(filename, 'utf8')
    .replace('</head>', '  <link rel="stylesheet" href="preview-banner.css">\n</head>')
    .replace(/<script src="site\.js(?:\?v=[a-zA-Z0-9_-]+)?" defer><\/script>/, '')
    .replace(/<script src="trial\.js(?:\?v=[a-zA-Z0-9_-]+)?" defer><\/script>/, `<script src="test-fixture.js?case=${scenario}" defer></script><script src="site.js" defer></script><script src="trial.js" defer></script>`)
    .replace('<body id="top">', `<body id="top"><p class="local-preview-banner">LOCAL TEST: ${scenario} / 실제 제품 및 배포 자료가 아닙니다</p>`);
  send(body, contentType);
}).listen(4173, '127.0.0.1', () => {
  console.log('Local preview: http://127.0.0.1:4173');
  console.log(`Fixtures: ${allowedCases.map(name => `/preview/${name}`).join(', ')}`);
});
