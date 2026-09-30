'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { JSDOM } = require('jsdom');
const katex = require('katex');

const script = fs.readFileSync(path.join(__dirname, '..', 'content-v120.js'), 'utf8');
const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  runScripts: 'outside-only',
  pretendToBeVisual: true
});
const { window } = dom;
window.katex = katex;
window.ClipboardItem = class ClipboardItem { constructor(x) { this.data = x; } };
window.navigator.clipboard = { write: async () => {} };
window.eval(script);

const api = window.__CGO_V120_TEST__;
assert(api && api.findScope, 'scope test hook missing');

const main = window.document.createElement('main');
const article = window.document.createElement('article');
const p1 = window.document.createElement('p');
p1.textContent = '在神经网络训练中，需要计算';
const formula = window.document.createElement('span');
formula.setAttribute('data-math-source', String.raw`\frac{\partial L}{\partial \theta}`);
formula.textContent = 'formula';
const p2 = window.document.createElement('p');
p2.textContent = '其中 L 为损失函数';
article.append(p1, formula, p2);
main.appendChild(article);
window.document.body.appendChild(main);

const range = window.document.createRange();
range.selectNodeContents(article);
assert.strictEqual(api.findScope(range), article,
  'article without assistant role must still be selected');
assert.strictEqual(api.collect(range, api.findScope(range)).length, 1,
  'formula in role-less article was not detected');

article.replaceWith(p1, formula, p2);
const broad = window.document.createRange();
broad.setStart(p1.firstChild, 0);
broad.setEnd(p2.firstChild, p2.firstChild.nodeValue.length);
const scope = api.findScope(broad);
assert(scope, 'metadata-free range did not get a scope');
assert.strictEqual(api.collect(broad, scope).length, 1,
  'metadata-free range lost selected formula');

console.log('v1.2.2 scope regression suite: PASS');
