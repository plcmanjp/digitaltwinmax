const test = require('node:test');
const assert = require('node:assert/strict');
const { selectTrial, loadTrial, API_URL } = require('../docs/releases.js');
const { asset, release, response, cases } = require('./fixtures.cjs');

test('no public release produces an empty state without a download URL', () => {
  assert.deepEqual(selectTrial([]), { state: 'empty' });
});
test('only explicit trial tags qualify; drafts never appear; prereleases do', () => {
  assert.equal(selectTrial([release('1.0.0', { tag_name: 'v1.0.0' }), release('0.1.0', { draft: true })]).state, 'empty');
  const selected = selectTrial(cases.available);
  assert.equal(selected.version, '0.2.0-beta.1');
  assert.equal(selected.prerelease, true);
});
test('the newest published trial is chosen independently of API and version order', () => {
  const result = selectTrial([release('9.0.0', { published_at: '2025-12-01T00:00:00Z' }), release('0.1.0')]);
  assert.equal(result.version, '0.1.0');
});
test('missing files on the newest trial do not expose an older download', () => {
  const result = selectTrial(cases['no-files']);
  assert.equal(result.state, 'no-files');
  assert.equal(result.version, '0.3.0');
  assert.deepEqual(result.assets, []);
});
test('multiple matching assets are shown in deterministic architecture and format order', () => {
  const result = selectTrial(cases.available);
  assert.deepEqual(result.assets.map(a => `${a.arch}.${a.format}`), ['x64.exe', 'x64.msi', 'x64.zip', 'arm64.zip']);
  assert.ok(result.assets.every(a => a.name.startsWith('DigitalTwinMax-Trial-0.2.0-beta.1-')));
});
test('source archives, unrelated files, other versions, platforms, zero bytes and unfinished uploads are excluded', () => {
  const invalid = [
    asset('0.1.0', 'x86'), asset('0.2.0'), asset('0.1.0', 'x64', 'tar.gz'),
    asset('0.1.0', 'x64', 'exe', { size: 0 }), asset('0.1.0', 'x64', 'exe', { state: 'starter' }),
    asset('0.1.0', 'x64', 'exe', { name: 'Source code.zip' }),
    asset('0.1.0', 'x64', 'exe', { name: 'DigitalTwinMax-Trial-0.1.0-windows-x64.exe.sha256' })
  ];
  assert.equal(selectTrial([release('0.1.0', { assets: invalid })]).state, 'no-files');
});
test('links must point to exactly this repository and matching release and filename', () => {
  const wrongUrls = ['https://example.invalid/trial.exe', 'javascript:alert(1)',
    `${asset().browser_download_url}?redirect=elsewhere`, asset().browser_download_url.replace('digitaltwinmax', 'another-repo')];
  for (const url of wrongUrls) assert.equal(selectTrial([release('0.1.0', { assets: [asset('0.1.0', 'x64', 'exe', { browser_download_url: url })] })]).state, 'no-files');
  assert.equal(selectTrial([release('0.1.0', { html_url: 'https://example.invalid/release' })]).state, 'empty');
});
test('duplicate assets are not repeated and notes remain data', () => {
  assert.equal(selectTrial([release('0.1.0', { assets: [asset(), asset()] })]).assets.length, 1);
  assert.equal(selectTrial(cases['unsafe-notes']).notes, cases['unsafe-notes'][0].body);
});
test('anonymous API requests omit credentials and authorization; pagination uses only fixed repository URLs', async () => {
  const calls = [];
  const result = await loadTrial({ fetchImpl: async (url, options) => {
    calls.push({ url, options });
    return calls.length === 1 ? response([], 200, '<https://example.invalid/next>; rel="next"') : response(cases.available);
  } });
  assert.equal(result.state, 'available');
  assert.deepEqual(calls.map(c => c.url), [`${API_URL}?per_page=100&page=1`, `${API_URL}?per_page=100&page=2`]);
  for (const { options } of calls) {
    assert.equal(options.credentials, 'omit');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.referrerPolicy, 'no-referrer');
    assert.equal(Object.keys(options.headers).some(k => k.toLowerCase() === 'authorization'), false);
  }
});
test('actual empty-list API shape resolves to preparation state', async () => {
  assert.deepEqual(await loadTrial({ fetchImpl: async () => response([]) }), { state: 'empty' });
});
for (const status of [403, 429, 404, 500]) {
  test(`HTTP ${status} produces a safe error, not a fabricated empty release`, async () => {
    await assert.rejects(loadTrial({ fetchImpl: async () => response({}, status) }), { code: [403, 429].includes(status) ? 'rate-limit' : 'http' });
  });
}
test('offline and failed network requests are reported', async () => {
  await assert.rejects(loadTrial({ fetchImpl: async () => { throw new TypeError('offline'); } }), { code: 'network' });
});
test('invalid JSON and malformed release lists are rejected', async () => {
  await assert.rejects(loadTrial({ fetchImpl: async () => response({ message: 'not a release list' }) }), { code: 'format' });
  await assert.rejects(loadTrial({ fetchImpl: async () => ({ ...response([]), json: async () => { throw new SyntaxError(); } }) }), { code: 'format' });
  assert.throws(() => selectTrial([null]), { code: 'format' });
});
test('an incomplete paginated list never selects a potentially stale download', async () => {
  let count = 0;
  await assert.rejects(loadTrial({ fetchImpl: async () => { count++; return response(cases.available, 200, '<next>; rel="next"'); } }), { code: 'limit' });
  assert.equal(count, 3);
});
test('a slow request is aborted and reported as a timeout', async () => {
  await assert.rejects(loadTrial({ timeoutMs: 10, fetchImpl: async (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  }) }), { code: 'timeout' });
});
