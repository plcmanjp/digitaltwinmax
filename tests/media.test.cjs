const test = require('node:test');
const assert = require('node:assert/strict');
const { localAsset, normalizeItems, clampIndex, closestIndex, mount } = require('../docs/media.js');

// Synthetic metadata only. No product media or actual downloadable files.
const image = (n = 1, extra = {}) => ({ src: `assets/test-image-${n}.svg`, alt: `합성 테스트 이미지 ${n}`, title: `테스트 ${n}`, ...extra });
const video = (n = 1, extra = {}) => ({ src: `assets/test-video-${n}.mp4`, poster: `assets/test-poster-${n}.svg`, title: `합성 테스트 영상 ${n}`, captions: `assets/test-captions-${n}.vtt`, ...extra });

test('local media accepts only supported asset paths for the requested kind', () => {
  for (const ext of ['avif', 'webp', 'png', 'jpg', 'jpeg', 'svg', 'WEBP']) assert.equal(localAsset(`assets/approved/a-b_2.${ext}`, 'image'), `assets/approved/a-b_2.${ext}`);
  assert.equal(localAsset('assets/clip.mp4', 'video'), 'assets/clip.mp4');
  assert.equal(localAsset('assets/clip.webm', 'video'), 'assets/clip.webm');
  assert.equal(localAsset('assets/clip-ko.vtt', 'captions'), 'assets/clip-ko.vtt');
  assert.equal(localAsset('assets/description.txt', 'transcript'), 'assets/description.txt');
  assert.equal(localAsset('assets/description.html', 'transcript'), 'assets/description.html');
});
test('external, traversal, encoded, query and malformed paths are rejected', () => {
  for (const src of [null, 1, {}, '', '/assets/a.svg', '../assets/a.svg', 'assets/../a.svg', 'assets/a..svg', 'assets/%2e%2e/a.svg', 'assets\\a.svg', 'https://example.com/a.svg', '//example.com/a.svg', 'data:image/svg+xml,test', 'javascript:alert(1)', 'assets/a.svg?x=1', 'assets/a.svg#x', 'assets/a b.svg']) assert.equal(localAsset(src, 'image'), '', String(src));
});
test('media kinds cannot cross-load scripts, HTML, unsupported formats or other file types', () => {
  for (const [src, kind] of [['assets/a.js', 'image'], ['assets/a.html', 'image'], ['assets/a.gif', 'image'], ['assets/a.svg', 'video'], ['assets/a.mp4', 'captions'], ['assets/a.vtt', 'transcript'], ['assets/a.svg', 'unknown']]) assert.equal(localAsset(src, kind), '');
});
test('zero media and malformed collections normalize to an empty list', () => {
  for (const input of [undefined, null, {}, '', [], [null, 1, '', {}, []]]) assert.deepEqual(normalizeItems(input, 'images'), []);
  assert.deepEqual(normalizeItems([image()], 'unsupported'), []);
});
test('images need a local source and meaningful alternative text', () => {
  assert.equal(normalizeItems([image()], 'images').length, 1);
  assert.deepEqual(normalizeItems([image(1, { alt: '' }), image(2, { alt: ' ' }), image(3, { alt: 3 }), image(4, { src: 'https://example.com/a.svg' })], 'images'), []);
});
test('disabled entries are not rendered; this is filtering, not private storage', () => {
  const result = normalizeItems([image(1, { published: false }), image(2)], 'images');
  assert.equal(result.length, 1);
  assert.equal(result[0].src, 'assets/test-image-2.svg');
});
test('image metadata is copied, trimmed and bounded without executing HTML', () => {
  const original = image(1, { alt: ' a ', title: '<img onerror=alert(1)>', caption: 'x'.repeat(1100), ignored: 'not copied' });
  const normalized = normalizeItems([original], 'images')[0];
  assert.equal(normalized.alt, 'a');
  assert.equal(normalized.title, '<img onerror=alert(1)>');
  assert.equal(normalized.caption.length, 1000);
  assert.equal(normalized.ignored, undefined);
  assert.equal(original.alt, ' a ');
  assert.equal(normalizeItems([image(1, { title: '' })], 'images')[0].title, '이미지 1');
});
test('videos require source, title, poster and captions unless explicitly silent', () => {
  assert.equal(normalizeItems([video()], 'videos').length, 1);
  for (const extra of [{ src: '' }, { title: '' }, { poster: '' }, { captions: '' }, { captions: '', silent: 'true' }]) assert.deepEqual(normalizeItems([video(1, extra)], 'videos'), []);
  const silent = normalizeItems([video(1, { captions: '', silent: true })], 'videos')[0];
  assert.equal(silent.silent, true);
  assert.equal(silent.captions, '');
});
test('caption and transcript metadata use local paths and sensible language defaults', () => {
  const result = normalizeItems([video(1, { language: 'en-US', captionLabel: 'English', transcript: 'assets/description.txt' })], 'videos')[0];
  assert.equal(result.language, 'en-US');
  assert.equal(result.captionLabel, 'English');
  assert.equal(result.transcript, 'assets/description.txt');
  const fallback = normalizeItems([video(1, { language: 'invalid-language-code', captionLabel: '', transcript: 'https://example.com/' })], 'videos')[0];
  assert.equal(fallback.language, 'ko');
  assert.equal(fallback.captionLabel, '한국어');
  assert.equal(fallback.transcript, '');
});
test('index helpers clamp boundaries and select the closest snap position', () => {
  assert.equal(clampIndex(-2, 3), 0);
  assert.equal(clampIndex(50, 3), 2);
  assert.equal(clampIndex(1.6, 3), 2);
  assert.equal(clampIndex(NaN, 3), 0);
  assert.equal(clampIndex(4, 0), 0);
  assert.equal(closestIndex(0, [0, 862, 1668]), 0);
  assert.equal(closestIndex(800, [0, 862, 1668]), 1);
  assert.equal(closestIndex(1668, [0, 862, 1668]), 2);
});

// A small DOM/event fixture, not a browser substitute. Real layout, touch and
// codec behavior remain browser QA responsibilities.
class Element {
  constructor(tag, doc) { this.tagName = tag.toUpperCase(); this.ownerDocument = doc; this.children = []; this.className = ''; this.attributes = {}; this.listeners = {}; this.hidden = false; this.textContent = ''; this.scrollLeft = 0; this.clientWidth = 900; this.scrollWidth = 900; this.pauseCount = 0; this.paused = true; this.scrollCalls = []; }
  get classList() {
    const read = () => new Set(this.className.split(/\s+/).filter(Boolean));
    return { add: value => { const s = read(); s.add(value); this.className = [...s].join(' '); }, contains: value => read().has(value), toggle: (value, force) => { const s = read(); const add = force === undefined ? !s.has(value) : force; if (add) s.add(value); else s.delete(value); this.className = [...s].join(' '); return add; } };
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  append(...children) { children.forEach(child => { child.parent = this; child.offsetLeft = 100 + this.children.length * 862; this.children.push(child); }); if (this.classList.contains('gallery-track')) this.scrollWidth = Math.max(900, this.children.length * 862 - 18); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  querySelectorAll(selector) { const matches = el => selector.startsWith('.') ? el.classList.contains(selector.slice(1)) : el.tagName.toLowerCase() === selector; return this.children.flatMap(child => [...(matches(child) ? [child] : []), ...child.querySelectorAll(selector)]); }
  addEventListener(name, listener) { (this.listeners[name] ||= []).push(listener); }
  emit(name, overrides = {}) { const event = { target: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...overrides }; (this.listeners[name] || []).forEach(listener => listener(event)); return event; }
  pause() { this.paused = true; this.pauseCount++; }
  scrollTo(options) { this.scrollCalls.push(options); this.scrollLeft = options.left; }
}
function fixture({ reduced = false } = {}) {
  const timers = new Map(); const frames = new Map(); const observers = []; const resizeObservers = []; let id = 0;
  const win = { listeners: {}, matchMedia: () => ({ matches: reduced }), setTimeout: fn => { timers.set(++id, fn); return id; }, clearTimeout: n => timers.delete(n), requestAnimationFrame: fn => { frames.set(++id, fn); return id; }, addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }, emit(name) { (this.listeners[name] || []).forEach(fn => fn()); }, IntersectionObserver: class { constructor(callback) { this.callback = callback; this.targets = []; observers.push(this); } observe(target) { this.targets.push(target); } }, ResizeObserver: class { constructor(callback) { this.callback = callback; resizeObservers.push(this); } observe(target) { this.target = target; } } };
  const doc = { defaultView: win, hidden: false, listeners: {}, createElement(tag) { return new Element(tag, this); }, addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }, emit(name) { (this.listeners[name] || []).forEach(fn => fn()); } };
  const section = doc.createElement('section'); section.id = 'test-media';
  const gallery = doc.createElement('div'); gallery.className = 'gallery'; gallery.hidden = true;
  const empty = doc.createElement('p'); empty.className = 'media-empty';
  const state = doc.createElement('span'); state.className = 'collection-state'; state.textContent = '공개 준비 중';
  section.append(gallery, empty, state);
  const flush = queue => { const current = [...queue.values()]; queue.clear(); current.forEach(fn => fn()); };
  return { section, gallery, empty, state, doc, win, observers, resizeObservers, flushTimers: () => flush(timers), flushFrames: () => flush(frames) };
}

test('empty galleries retain their quiet ready state without controls', () => {
  const f = fixture();
  assert.equal(mount(f.section, [], 'images'), null);
  assert.equal(f.gallery.hidden, true);
  assert.equal(f.empty.hidden, false);
  assert.equal(f.section.querySelectorAll('button').length, 0);
});
test('single-image galleries show one slide and mark redundant navigation for CSS hiding', () => {
  const f = fixture(); const api = mount(f.section, [image()], 'images');
  assert.equal(f.gallery.hidden, false);
  assert.equal(f.empty.hidden, true);
  assert.equal(f.gallery.classList.contains('is-single'), true);
  assert.equal(api.track.tabIndex, -1);
  assert.equal(api.slides.length, 1);
  assert.equal(f.state.textContent, '01 IMAGES');
  assert.equal(f.section.querySelector('img').alt, '합성 테스트 이미지 1');
});
test('multiple galleries expose labels, counts, constrained navigation and no automatic advance', () => {
  const f = fixture(); const api = mount(f.section, [image(1), image(2), image(3)], 'images');
  const [previous, next] = f.section.querySelectorAll('button');
  assert.equal(api.track.tabIndex, 0);
  assert.equal(api.track.getAttribute('aria-roledescription'), '캐러셀');
  assert.equal(previous.getAttribute('aria-disabled'), 'true');
  assert.equal(next.getAttribute('aria-disabled'), 'false');
  f.flushTimers(); assert.equal(api.index, 0);
  next.emit('click'); next.emit('click'); next.emit('click');
  assert.equal(api.index, 2);
  assert.equal(next.getAttribute('aria-disabled'), 'true');
  assert.equal(f.section.querySelector('.gallery-position').textContent, '03 / 03');
  previous.emit('click'); assert.equal(api.index, 1);
});
test('focused tracks accept arrows, Home and End without hijacking descendant controls', () => {
  const f = fixture(); const api = mount(f.section, [image(1), image(2), image(3)], 'images');
  assert.equal(api.track.emit('keydown', { key: 'ArrowRight' }).defaultPrevented, true);
  assert.equal(api.index, 1);
  api.track.emit('keydown', { key: 'End' }); assert.equal(api.index, 2);
  api.track.emit('keydown', { key: 'Home' }); assert.equal(api.index, 0);
  api.track.emit('keydown', { key: 'ArrowLeft' }); assert.equal(api.index, 0);
  assert.equal(api.track.emit('keydown', { key: 'ArrowRight', target: api.slides[0] }).defaultPrevented, false);
  assert.equal(api.index, 0);
  assert.equal(api.track.emit('keydown', { key: 'PageDown' }).defaultPrevented, false);
});
test('reduced motion changes programmatic navigation to immediate scrolling', () => {
  const f = fixture({ reduced: true }); const api = mount(f.section, [image(1), image(2)], 'images');
  api.go(1);
  assert.equal(api.track.scrollCalls.at(-1).behavior, 'auto');
  const normal = fixture(); const normalApi = mount(normal.section, [image(1), image(2)], 'images');
  normalApi.go(1);
  assert.equal(normalApi.track.scrollCalls.at(-1).behavior, 'smooth');
});
test('native pointer/wheel scroll updates the displayed position after navigation takeover', () => {
  const f = fixture(); const api = mount(f.section, [image(1), image(2), image(3)], 'images');
  api.go(1);
  api.track.emit('pointerdown'); api.track.scrollLeft = 1668; api.track.emit('scroll'); f.flushFrames();
  assert.equal(api.index, 2);
  api.track.emit('wheel'); api.track.scrollLeft = 0; api.track.emit('scroll'); f.flushFrames();
  assert.equal(api.index, 0);
});
test('resize preserves the selected item and snaps immediately', () => {
  const f = fixture(); const api = mount(f.section, [image(1), image(2)], 'images');
  api.go(1); f.resizeObservers[0].callback();
  assert.equal(api.index, 1);
  assert.equal(api.track.scrollCalls.at(-1).behavior, 'auto');
});
test('image loading failures display a textual fallback without inventing replacement imagery', () => {
  const f = fixture(); mount(f.section, [image()], 'images');
  f.section.querySelector('img').emit('error');
  assert.equal(f.section.querySelector('.media-failure').hidden, false);
  assert.equal(f.section.querySelector('.gallery-slide').classList.contains('media-error'), true);
});
test('videos are user-controlled, inline, initially muted and not preloaded', () => {
  const f = fixture(); mount(f.section, [video(1, { transcript: 'assets/description.txt' })], 'videos');
  const media = f.section.querySelector('video'); const track = f.section.querySelector('track');
  assert.equal(media.controls, true); assert.equal(media.preload, 'none'); assert.equal(media.playsInline, true);
  assert.equal(media.muted, true); assert.equal(media.defaultMuted, true); assert.notEqual(media.autoplay, true);
  assert.equal(media.poster, 'assets/test-poster-1.svg');
  assert.equal(track.kind, 'captions'); assert.equal(track.default, true); assert.equal(track.srclang, 'ko');
  assert.equal(f.section.querySelector('a').href, 'assets/description.txt');
});
test('changing video slides pauses outgoing videos and transfers video tab focus eligibility', () => {
  const f = fixture(); const api = mount(f.section, [video(1), video(2)], 'videos');
  const [first, second] = f.section.querySelectorAll('video');
  first.paused = false; api.go(1);
  assert.equal(first.paused, true); assert.equal(first.tabIndex, -1); assert.equal(second.tabIndex, 0);
  first.paused = false; first.emit('play');
  assert.equal(api.index, 0); assert.equal(second.paused, true); assert.equal(first.tabIndex, 0);
});
test('viewport exit, hidden documents and page exit pause videos without resuming them', () => {
  const f = fixture(); mount(f.section, [video()], 'videos'); const media = f.section.querySelector('video');
  media.paused = false; f.observers[0].callback([{ target: media, intersectionRatio: 0.2 }]); assert.equal(media.paused, true);
  media.paused = false; f.doc.hidden = true; f.doc.emit('visibilitychange'); assert.equal(media.paused, true);
  media.paused = false; f.win.emit('pagehide'); assert.equal(media.paused, true);
  f.doc.hidden = false; f.doc.emit('visibilitychange'); assert.equal(media.paused, true);
});
test('video and caption failures remain visible as accessible status messages', () => {
  const f = fixture(); mount(f.section, [video()], 'videos');
  const media = f.section.querySelector('video'); media.paused = false; media.emit('error');
  assert.equal(media.paused, true); assert.equal(f.section.querySelector('.media-failure').hidden, false);
  f.section.querySelector('track').emit('error');
  assert.equal(f.section.querySelector('.caption-warning').hidden, false);
  assert.equal(f.section.querySelector('.caption-warning').getAttribute('role'), 'status');
});
test('captions and titles are inserted as text rather than interpreted markup', () => {
  const f = fixture(); mount(f.section, [image(1, { title: '<script>alert(1)</script>', caption: '<img src=x>' })], 'images');
  assert.equal(f.section.querySelectorAll('script').length, 0);
  assert.equal(f.section.querySelectorAll('img').length, 1);
  assert.equal(f.section.querySelector('.media-caption').querySelector('strong').textContent, '<script>alert(1)</script>');
});
