'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { JSDOM } = require('jsdom');
const katex = require('katex');

const adapter = fs.readFileSync(path.join(__dirname, '..', 'content-v121-office-punct.js'), 'utf8');

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  runScripts: 'outside-only',
  pretendToBeVisual: true
});
const { window } = dom;
window.navigator.clipboard = { write: async () => {} };
window.ClipboardItem = class ClipboardItem {
  constructor(payload) {
    this.payload = payload;
    this.types = Object.keys(payload || {});
  }
  async getType(type) { return this.payload[type]; }
};
window.eval(adapter);

const api = window.__CGO_V121_TEST__;
assert(api, 'v1.2.1 test hook missing');

function katexMath(tex, displayMode = false) {
  return katex.renderToString(tex, {
    output: 'mathml',
    displayMode,
    throwOnError: false,
    strict: 'ignore'
  });
}

function parseMath(html) {
  const d = new JSDOM(`<body>${html}</body>`).window.document;
  return d.querySelector('math');
}

function presentationText(math) {
  const clone = math.cloneNode(true);
  clone.querySelectorAll('annotation,annotation-xml').forEach(x => x.remove());
  return clone.textContent.replace(/\s+/g, '');
}

// 1) This is the exact failure seen in PowerPoint: P(s=0,t) became P(s=0t).
const rawP = katexMath('P(s=0,t)');
assert(/<mo[^>]*separator="true"[^>]*>\s*,\s*<\/mo>/.test(rawP),
  'Pinned KaTeX no longer exposes the expected separator comma; reassess adapter');
const fixedP = api.normalizeOfficeMathHTML(rawP);
assert(fixedP.includes('<mtext data-cgo-office-punct="1">,</mtext>'),
  'P(s=0,t) comma was not converted to an Office-safe mtext run');
assert(!/<mo[^>]*separator="true"[^>]*>\s*,\s*<\/mo>/.test(fixedP),
  'separator=true comma survived normalization');
assert.strictEqual(presentationText(parseMath(fixedP)), 'P(s=0,t)',
  'P(s=0,t) Presentation MathML order changed during normalization');

// 2) Parameter vectors: all internal commas must survive and become mtext.
const vecTex = String.raw`\mu_{\mathrm{acc}}=[P_0,\dot m_0,T_{\mathrm{in},0},A_{\mathrm{dist}},\tau_{\mathrm{coast}},t_{\mathrm{start}},\eta_{\mathrm{heat\,sink}}]`;
const rawVec = katexMath(vecTex, true);
const fixedVec = api.normalizeOfficeMathHTML(rawVec);
const vecDoc = new JSDOM(`<body>${fixedVec}</body>`).window.document;
const vecCommas = [...vecDoc.querySelectorAll('math mtext[data-cgo-office-punct="1"]')]
  .filter(x => x.textContent === ',');
assert(vecCommas.length >= 6, `parameter vector retained only ${vecCommas.length} protected commas`);
assert(!vecDoc.querySelector('math mo[separator="true"]'),
  'parameter vector still contains Office-risk separator operators');
assert(presentationText(vecDoc.querySelector('math')).includes('P0,m˙0,Tin,0'),
  'parameter-vector comma ordering changed');

// 3) Display formula: internal comma remains, while v1.2.0 is responsible for
// removing sentence-final punctuation before this adapter runs.
const rawDisplay = katexMath(String.raw`s=\left(\frac{r}{R}\right)^2,\qquad s\in[0,1]`, true);
const fixedDisplay = api.normalizeOfficeMathHTML(rawDisplay);
const displayDoc = new JSDOM(`<body>${fixedDisplay}</body>`).window.document;
assert(displayDoc.querySelector('mfrac'), 'fraction structure was damaged');
assert(displayDoc.querySelector('msup'), 'superscript structure was damaged');
assert([...displayDoc.querySelectorAll('mtext[data-cgo-office-punct="1"]')]
  .some(x => x.textContent === ','), 'display internal comma was not protected');

// 4) Do not touch decimal number text or ordinary operators.
const rawDecimal = katexMath(String.raw`x=0.125+y`);
const fixedDecimal = api.normalizeOfficeMathHTML(rawDecimal);
const decimalMath = parseMath(fixedDecimal);
assert(presentationText(decimalMath).includes('0.125'), 'decimal point was altered');
assert(presentationText(decimalMath).includes('+'), 'ordinary operator was altered');

console.log('v1.2.1 Office punctuation regression suite: PASS');
console.log('checked: KaTeX separator comma -> mtext, P(s=0,t), parameter vectors, display fractions/powers, decimal safety');
