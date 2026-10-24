// Synthetic metadata only. These files and releases do not exist on GitHub.
const repo = 'https://github.com/plcmanjp/digitaltwinmax/releases';
function asset(version = '0.1.0', arch = 'x64', format = 'exe', overrides = {}) {
  const name = `DigitalTwinMax-Trial-${version}-windows-${arch}.${format}`;
  return { name, state: 'uploaded', size: 12582912, browser_download_url: `${repo}/download/trial-v${version}/${name}`, ...overrides };
}
function release(version = '0.1.0', overrides = {}) {
  return { tag_name: `trial-v${version}`, draft: false, prerelease: false,
    html_url: `${repo}/tag/trial-v${version}`, published_at: '2026-01-15T00:00:00Z',
    body: '테스트용 릴리스 노트입니다. 실제 배포 파일이 아닙니다.\n지원 환경과 이용 조건은 공개 전에 작성합니다.',
    assets: [asset(version)], ...overrides };
}
function response(data, status = 200, link = '') {
  return { ok: status >= 200 && status < 300, status, headers: { get: key => key.toLowerCase() === 'link' ? link : null }, json: async () => data };
}
const cases = {
  empty: [],
  available: [release('0.2.0-beta.1', { prerelease: true, assets: [
    asset('0.2.0-beta.1', 'arm64', 'zip'), asset('0.2.0-beta.1', 'x64', 'msi'),
    asset('0.2.0-beta.1', 'x64', 'exe'), asset('0.2.0-beta.1', 'x64', 'zip'),
    { name: 'Source code.zip', state: 'uploaded', size: 1024, browser_download_url: `${repo}/archive/source.zip` }
  ] })],
  'no-files': [release('0.3.0', { assets: [] }), release('0.1.0', { published_at: '2026-01-01T00:00:00Z' })],
  'unsafe-notes': [release('0.1.0', { body: '<img src=x onerror=alert(1)>\n[외부 링크](https://example.invalid)\n그대로 읽히는 테스트 텍스트' })]
};
module.exports = { repo, asset, release, response, cases };
