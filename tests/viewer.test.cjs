const test = require('node:test');
const assert = require('node:assert/strict');
const { localImage, mount } = require('../docs/viewer.js');

class Element {
  constructor(tag, doc) {
    this.tagName = tag.toUpperCase();
    this.ownerDocument = doc;
    this.children = [];
    this.className = '';
    this.attributes = {};
    this.listeners = {};
    this.textContent = '';
    this.alt = '';
    this.open = false;
    if (tag === 'dialog') {
      this.showModal = () => { this.open = true; this.setAttribute('open', ''); };
      this.close = () => { this.open = false; this.removeAttribute('open'); this.emit('close'); };
    }
  }
  get classList() {
    const read = () => new Set(this.className.split(/\s+/).filter(Boolean));
    return { contains: value => read().has(value) };
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  hasAttribute(name) { return this.attributes[name] !== undefined; }
  removeAttribute(name) { delete this.attributes[name]; }
  append(...children) { children.forEach(child => { child.parentElement = this; this.children.push(child); }); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  querySelectorAll(selector) {
    const matches = el => selector.startsWith('.') ? el.classList.contains(selector.slice(1)) : el.tagName.toLowerCase() === selector;
    return this.children.flatMap(child => [...(matches(child) ? [child] : []), ...child.querySelectorAll(selector)]);
  }
  addEventListener(name, listener) { (this.listeners[name] ||= []).push(listener); }
  emit(name, overrides = {}) {
    const event = { target: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...overrides };
    (this.listeners[name] || []).forEach(listener => listener(event));
    return event;
  }
  focus() { this.ownerDocument.active = this; }
}
function page() {
  const doc = { active: null, createElement(tag) { return new Element(tag, this); }, querySelector(selector) { return this.body.querySelector(selector); }, querySelectorAll(selector) { return this.body.querySelectorAll(selector); } };
  const body = doc.createElement('body');
  doc.body = body;
  const hero = doc.createElement('figure');
  const heroFrame = doc.createElement('button');
  heroFrame.className = 'zoom-frame';
  const heroImage = doc.createElement('img');
  heroImage.setAttribute('src', 'assets/hero.jpg');
  heroImage.setAttribute('alt', '등각 설명');
  const heroCaption = doc.createElement('figcaption');
  heroCaption.textContent = '등각 시점';
  heroFrame.append(heroImage);
  hero.append(heroFrame, heroCaption);
  const article = doc.createElement('article');
  const frame = doc.createElement('button');
  frame.className = 'zoom-frame';
  const image = doc.createElement('img');
  image.setAttribute('src', 'assets/top.jpg');
  image.setAttribute('alt', '<img onerror=alert(1)>');
  const heading = doc.createElement('h3');
  heading.textContent = '<script>alert(1)</script>';
  frame.append(image);
  article.append(frame, heading);
  body.append(hero, article);
  return { doc, heroFrame, frame };
}

test('lightbox image paths stay on local raster files', () => {
  assert.equal(localImage('assets/scene.jpg'), 'assets/scene.jpg');
  assert.equal(localImage('assets/approved/a-b_2.WEBP'), 'assets/approved/a-b_2.WEBP');
  for (const src of ['', 'assets/mark.svg', 'assets/a.jpg?x=1', 'https://example.com/a.jpg', 'assets/../a.jpg', 'javascript:alert(1)']) assert.equal(localImage(src), '');
});
test('a scene opens in a dialog and closes back to the same control', () => {
  const { doc, frame } = page();
  const api = mount(doc);
  assert.equal(api.open(frame), true);
  frame.emit('click');
  const dialog = doc.querySelector('.lightbox');
  const image = dialog.querySelector('img');
  assert.equal(dialog.open, true);
  assert.equal(image.src, 'assets/top.jpg');
  assert.equal(image.alt, '<img onerror=alert(1)>');
  assert.equal(dialog.querySelector('figcaption').textContent, '<script>alert(1)</script>');
  assert.equal(doc.querySelectorAll('script').length, 0);
  dialog.querySelector('.lightbox-close').emit('click');
  assert.equal(dialog.open, false);
  assert.equal(image.getAttribute('src'), null);
  assert.equal(doc.active, frame);
});
test('the backdrop closes the dialog and another scene keeps its own picture', () => {
  const { doc, heroFrame, frame } = page();
  const api = mount(doc);
  heroFrame.emit('click');
  const dialog = api.dialog;
  assert.equal(dialog.querySelector('img').src, 'assets/hero.jpg');
  assert.equal(dialog.querySelector('figcaption').textContent, '등각 시점');
  dialog.emit('click', { target: dialog.querySelector('img') });
  assert.equal(dialog.open, true);
  dialog.emit('click');
  assert.equal(dialog.open, false);
  frame.emit('click');
  assert.equal(dialog.querySelector('img').src, 'assets/top.jpg');
  assert.equal(mount(doc), null);
});
test('rejected image addresses do not open the dialog', () => {
  const { doc, frame } = page();
  frame.querySelector('img').setAttribute('src', 'https://example.com/a.jpg');
  const api = mount(doc);
  frame.emit('click');
  assert.equal(api.dialog.open, false);
  assert.equal(api.dialog.querySelector('img').getAttribute('src'), null);
});
test('a page without zoom frames does not create a dialog', () => {
  const doc = { body: null, createElement() { throw new Error('unexpected'); }, querySelector() { return null; }, querySelectorAll() { return []; } };
  assert.equal(mount(doc), null);
});
