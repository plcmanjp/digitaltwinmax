// Static guard for the landing restraint rules. It reads the deployed sources only.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const docs = path.resolve(__dirname, '../docs');
const read = name => fs.readFileSync(path.join(docs, name), 'utf8');
const html = read('index.html');
const css = read('styles.css') + read('hero.css');
const visibleText = html
  .replace(/<script[\s\S]*?<\/script>/g, '')
  .replace(/<style[\s\S]*?<\/style>/g, '')
  .replace(/<[^>]+>/g, ' ');

test('no section eyebrows, fake window chrome or decorative status dots', () => {
  for (const pattern of [/class="eyebrow/, /class="hero-eyebrow/, /win-dots/, /status-dot/, /hero-meta-strip/, /usage-tag/, /panel-label/, /bento-badge/, /roadmap-step/]) {
    assert.equal(pattern.test(html), false, `found ${pattern}`);
  }
});

test('no outline chip rows', () => {
  for (const pattern of [/class="step-specs/, /class="bento-chips/, /class="roadmap-chips/, /class="mcp-pipeline/]) {
    assert.equal(pattern.test(html), false, `found ${pattern}`);
  }
});

test('no emoji in visible text', () => {
  const emoji = [...visibleText].filter(ch => {
    const code = ch.codePointAt(0);
    return code >= 0x1f300 || (code >= 0x2600 && code <= 0x27bf);
  });
  assert.deepEqual(emoji, []);
});

test('no restricted punctuation in visible text or user-facing script strings', () => {
  const restricted = /[\u2014\u2013\u2015\u00b7\u30fb\u2022]/;
  assert.equal(restricted.test(visibleText), false, 'index.html');
  for (const name of ['trial.js', 'media-config.js', 'site.js', 'media.js', 'viewer.js']) {
    assert.equal(restricted.test(read(name)), false, name);
  }
});

test('the download card has no accent top border', () => {
  assert.equal(/border-top:\s*[2-9]px\s+solid\s+var\(--accent\)/.test(css), false);
});

test('the landing shows a release summary, not the full release notes', () => {
  const trial = read('trial.js');
  assert.match(trial, /extractSummary/);
  assert.equal(/trial-notes-text|excerpt\.slice/.test(trial), false);
});
