'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { JSDOM } = require('jsdom');
const katex = require('katex');

const script = fs.readFileSync(path.join(__dirname, '..', 'content-v120.js'), 'utf8');

const dom = new JSDOM(`<!doctype html><html><body>
<article id="turn" data-testid="conversation-turn-1">
  <div data-message-author-role="assistant" id="assistant">
    <p>正文中测试 <span id="inline" data-math-source="P(s=0,t)" class="katex">P(s=0,t)</span> 和普通文字。</p>
    <div id="display-wrap"><span id="display" class="katex-display" data-math-source="s=\\left(\\frac{r}{R}\\right)^2,\\qquad s\\in[0,1].">formula</span>.</div>
    <div><span id="vector" class="katex-display" data-math-source="\\mu_{\\mathrm{acc}}=[P_0,\\dot m_0,T_{\\mathrm{in},0},A_{\\mathrm{dist}},\\tau_{\\mathrm{coast}},t_{\\mathrm{start}},\\eta_{\\mathrm{heat\\,sink}}],">vector</span>,</div>
  </div>
</article>
</body></html>`, { runScripts: 'outside-only', pretendToBeVisual: true });

const { window } = dom;
window.katex = katex;
window.ClipboardItem = class ClipboardItem { constructor(x) { this.data = x; } };
window.navigator.clipboard = { write: async () => {} };
window.eval(script);

const api = window.__CGO_V120_TEST__;
assert(api, 'test hook missing');

// Source normalization: strip only display-ending sentence punctuation.
assert.strictEqual(api.stripDisplayTrailingPunctuation('P(s=0,t)'), 'P(s=0,t)');
assert.strictEqual(api.stripDisplayTrailingPunctuation('x+y.'), 'x+y');
assert.strictEqual(api.stripDisplayTrailingPunctuation('x+y,;'), 'x+y');
assert.strictEqual(api.stripDisplayTrailingPunctuation('x\\,'), 'x\\,');
assert.strictEqual(api.stripDisplayTrailingPunctuation('\\left. x \\right.'), '\\left. x \\right.');

// Current ChatGPT-style data-math-source extraction must preserve internal comma.
const inline = window.document.getElementById('inline');
assert.strictEqual(api.extractLatex(inline), 'P(s=0,t)');

// Direct renderer regressions.
const inlineMath = api.renderLatex('P(s=0,t)', false);
assert.strictEqual(inlineMath.getAttribute('display'), 'inline');
assert(inlineMath.outerHTML.includes('<mo>,</mo>'), 'internal comma in P(s=0,t) was lost');

const displayMath = api.renderLatex('s=\\left(\\frac{r}{R}\\right)^2,\\qquad s\\in[0,1].', true);
assert(displayMath.outerHTML.includes('<mfrac>'), 'fraction structure lost');
assert(displayMath.outerHTML.includes('<msup>'), 'superscript structure lost');
assert(displayMath.outerHTML.includes('<mo>,</mo>'), 'internal display comma lost');
assert(!/[.]\s*$/.test(displayMath.textContent.trim()), 'display terminal period not removed');

const vectorSource = '\\mu_{\\mathrm{acc}}=[P_0,\\dot m_0,T_{\\mathrm{in},0},A_{\\mathrm{dist}},\\tau_{\\mathrm{coast}},t_{\\mathrm{start}},\\eta_{\\mathrm{heat\\,sink}}],';
const vectorMath = api.renderLatex(vectorSource, true);
assert(vectorMath.outerHTML.includes('<msub>'), 'subscript structure lost');
assert(vectorMath.outerHTML.includes('<mover'), 'dot/accent structure lost');
assert(!vectorMath.textContent.trim().endsWith(','), 'display vector terminal comma not removed');

const empty = api.renderLatex('\\Omega_i\\cap\\Omega_{i+1}\\neq\\varnothing', false);
assert(empty.textContent.includes('∅'), 'varnothing not rendered as empty-set glyph');

const q = api.renderLatex('q_i=q_i^{\\mathrm{MASW}}q_i^{\\mathrm{SWD}}q_i^{\\mathrm{FWI}}', false);
assert(q.outerHTML.includes('<msubsup>') || q.outerHTML.includes('<msup>'), 'q_i superscript structure lost');

// Full selection regression: current ChatGPT formula containers -> 3 Office Math objects.
const article = window.document.getElementById('turn');
const range = window.document.createRange();
range.selectNodeContents(article);
const records = api.collect(range, article);
assert.strictEqual(records.length, 3, `expected 3 formula records, got ${records.length}`);

const result = api.cloneRangeWithMath(range, article);
assert.strictEqual(result.found, 3);
assert.strictEqual(result.written, 3);
const maths = [...result.div.querySelectorAll('math')];
assert.strictEqual(maths.length, 3, `expected 3 MathML nodes, got ${maths.length}`);

const out = result.div.innerHTML;
assert(out.includes('<mfrac>'), 'batch output lost fraction');
assert(out.includes('<mover'), 'batch output lost overdot');
assert(out.includes('<msub>'), 'batch output lost subscripts');
assert(maths[0].outerHTML.includes('<mo>,</mo>'), 'batch inline P(s=0,t) lost comma');
assert(!result.div.textContent.includes('formula.'), 'display punctuation sibling was not removed');
assert(!maths[1].textContent.trim().endsWith('.'), 'display source period survived');
assert(!maths[2].textContent.trim().endsWith(','), 'display source comma survived');

console.log('v1.2.0 regression suite: PASS');
console.log('checked: current data-math-source containers, P(s=0,t), mfrac/msup, msub, dot/mover, varnothing, display punctuation removal, batch replacement');
