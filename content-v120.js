'use strict';

// v1.2.0 — current ChatGPT formula-container pipeline.
//
// Key design rule: never reconstruct scientific formulas from visible glyph
// fragments. Read the formula source from current ChatGPT/KaTeX containers and
// let the bundled KaTeX engine produce Presentation MathML for Office.
(function () {
  const NS = 'http://www.w3.org/1998/Math/MathML';
  const FORMULA_SELECTOR = [
    '[data-math-source]',
    '[data-math]',
    '.katex-display',
    '.katex',
    'mjx-container',
    '[role="math"]',
    'math'
  ].join(',');
  const SENTENCE_PUNCT = /[,.;:!?，。！？；：]/;

  function safeIntersects(range, node) {
    try { return !!node && range.intersectsNode(node); } catch (_) { return false; }
  }

  function nodeOrder(a, b) {
    if (a === b) return 0;
    const p = a.compareDocumentPosition(b);
    return p & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
  }

  function formulaAnchor(node) {
    if (!node || node.nodeType !== 1) return null;
    const source = node.closest?.('[data-math-source],[data-math]');
    if (source) return source;
    const display = node.closest?.('.katex-display');
    if (display) return display;
    const katexNode = node.closest?.('.katex');
    if (katexNode) return katexNode;
    const mjx = node.closest?.('mjx-container');
    if (mjx) return mjx;
    const roleMath = node.closest?.('[role="math"]');
    if (roleMath) return roleMath;
    return (node.tagName || '').toLowerCase() === 'math' ? node : null;
  }

  function isDisplay(anchor) {
    if (!anchor) return false;
    if (anchor.matches?.('.katex-display')) return true;
    if (anchor.closest?.('.katex-display')) return true;
    if ((anchor.tagName || '').toLowerCase() === 'mjx-container' &&
        (anchor.getAttribute('display') || '').toLowerCase() === 'true') return true;
    const math = (anchor.tagName || '').toLowerCase() === 'math'
      ? anchor
      : anchor.querySelector?.('math');
    if (math && (math.getAttribute('display') || '').toLowerCase() === 'block') return true;
    const attr = (anchor.getAttribute?.('data-display') || anchor.getAttribute?.('data-math-display') || '').toLowerCase();
    if (attr === 'block' || attr === 'display' || attr === 'true') return true;
    try {
      const d = getComputedStyle(anchor).display || '';
      return d === 'block' || d === 'flex' || d === 'grid';
    } catch (_) { return false; }
  }

  function decodeBasicEntities(s) {
    const t = document.createElement('textarea');
    t.innerHTML = String(s || '');
    return t.value;
  }

  function trimMathDelimiters(s) {
    let x = decodeBasicEntities(String(s || '')).trim();
    const pairs = [
      ['\\[', '\\]'],
      ['\\(', '\\)'],
      ['$$', '$$'],
      ['$', '$']
    ];
    for (const [a, b] of pairs) {
      if (x.startsWith(a) && x.endsWith(b) && x.length >= a.length + b.length) {
        x = x.slice(a.length, x.length - b.length).trim();
        break;
      }
    }
    return x;
  }

  function stripDisplayTrailingPunctuation(tex) {
    // User preference: display equations carry no sentence-ending punctuation.
    // Internal punctuation (P(s=0,t), vectors, tuples, subscripts, matrices) is
    // untouched. Do not strip TeX spacing commands such as \, \\; or \\right.
    let x = String(tex || '').trimEnd();
    for (;;) {
      if (!x) break;
      const ch = x[x.length - 1];
      if (!SENTENCE_PUNCT.test(ch)) break;
      if (x.length >= 2 && x[x.length - 2] === '\\') break;
      if (ch === '.' && /\\(?:left|right)\.$/.test(x)) break;
      x = x.slice(0, -1).trimEnd();
    }
    return x;
  }

  function sourceFromElement(el) {
    if (!el || el.nodeType !== 1) return '';
    for (const k of ['data-math', 'data-math-source']) {
      const v = el.getAttribute?.(k);
      if (v && v.trim()) return trimMathDelimiters(v);
    }
    return '';
  }

  function extractLatex(anchor) {
    if (!anchor) return '';

    // 1. Source attributes used by current ChatGPT renderers.
    const own = sourceFromElement(anchor);
    if (own) return own;
    try {
      const child = anchor.querySelector('[data-math],[data-math-source]');
      const v = sourceFromElement(child);
      if (v) return v;
    } catch (_) {}

    // 2. Canonical TeX annotation from KaTeX/MathML.
    try {
      const ann = anchor.querySelector(
        'annotation[encoding="application/x-tex"], annotation[encoding*="tex" i], .katex-mathml annotation'
      );
      if (ann?.textContent?.trim()) return trimMathDelimiters(ann.textContent);
    } catch (_) {}

    return '';
  }

  function directMath(anchor) {
    if (!anchor) return null;
    if ((anchor.tagName || '').toLowerCase() === 'math') return anchor;
    try {
      return anchor.querySelector('.katex-mathml math, math');
    } catch (_) { return null; }
  }

  function expressionRoot(math) {
    const sem = [...math.children].find(x => x.localName === 'semantics');
    if (!sem) return math;
    return [...sem.children].find(x => x.localName !== 'annotation' && x.localName !== 'annotation-xml') || sem;
  }

  function lastLeaf(el) {
    if (!el) return null;
    const children = [...el.children].filter(x => x.localName !== 'annotation' && x.localName !== 'annotation-xml');
    for (let i = children.length - 1; i >= 0; i--) {
      const leaf = lastLeaf(children[i]);
      if (leaf && (leaf.textContent || '').trim()) return leaf;
    }
    return el;
  }

  function stripTerminalPunctuationFromMath(math) {
    let guard = 12;
    while (guard--) {
      const leaf = lastLeaf(expressionRoot(math));
      if (!leaf) break;
      const text = (leaf.textContent || '').trim();
      if (text.length !== 1 || !SENTENCE_PUNCT.test(text)) break;
      leaf.remove();
    }
  }

  function cleanMath(math, display) {
    const c = math.cloneNode(true);
    c.setAttribute('xmlns', NS);
    c.setAttribute('display', display ? 'block' : 'inline');
    // Office only needs Presentation MathML. Removing annotations prevents Word
    // or PowerPoint from preferring a stale textual source over the structure.
    c.querySelectorAll('annotation,annotation-xml').forEach(x => x.remove());
    if (display) stripTerminalPunctuationFromMath(c);
    return c;
  }

  function renderLatex(tex, display) {
    const engine = globalThis.katex || globalThis.window?.katex;
    if (!engine?.renderToString) throw new Error('KaTeX 引擎未加载');
    let source = trimMathDelimiters(tex);
    if (display) source = stripDisplayTrailingPunctuation(source);
    if (!source) throw new Error('公式源为空');

    const rendered = engine.renderToString(source, {
      throwOnError: false,
      displayMode: !!display,
      output: 'mathml',
      strict: 'ignore',
      trust: false,
      macros: {
        '\\boldsymbol': '\\mathbf',
        '\\bm': '\\mathbf',
        '\\RR': '\\mathbb{R}',
        '\\NN': '\\mathbb{N}',
        '\\ZZ': '\\mathbb{Z}'
      }
    });
    const tpl = document.createElement('template');
    tpl.innerHTML = rendered.trim();
    const math = tpl.content.querySelector('math');
    if (!math) throw new Error('KaTeX 未生成 MathML');
    return cleanMath(math, display);
  }

  function buildMath(anchor, display) {
    const tex = extractLatex(anchor);
    if (tex) return { math: renderLatex(tex, display), source: 'KaTeX source' };
    const native = directMath(anchor);
    if (native) return { math: cleanMath(native, display), source: 'native MathML' };
    return null;
  }

  function collect(range, msg) {
    let nodes = [];
    try { nodes = [...msg.querySelectorAll(FORMULA_SELECTOR)]; } catch (_) {}
    const anchors = [];
    const seen = new Set();

    for (const node of nodes) {
      const anchor = formulaAnchor(node);
      if (!anchor || seen.has(anchor) || !safeIntersects(range, anchor)) continue;
      seen.add(anchor);
      anchors.push(anchor);
    }

    anchors.sort(nodeOrder);
    const records = [];
    for (const anchor of anchors) {
      // If an outer formula anchor already owns this node, do not emit a nested
      // duplicate. One visual formula must become one Office Math object.
      if (records.some(r => r.anchor.contains?.(anchor))) continue;
      for (let i = records.length - 1; i >= 0; i--) {
        if (anchor.contains?.(records[i].anchor)) records.splice(i, 1);
      }
      const display = isDisplay(anchor);
      const built = buildMath(anchor, display);
      if (!built) continue;
      records.push({ anchor, display, math: built.math, source: built.source });
    }
    records.sort((a, b) => nodeOrder(a.anchor, b.anchor));
    return records;
  }

  function removeAdjacentDisplayPunctuation(math) {
    // Display equation punctuation is intentionally removed, including a
    // punctuation token stored outside the formula container by the page DOM.
    let n = math.nextSibling;
    if (!n) return;
    if (n.nodeType === Node.TEXT_NODE) {
      n.nodeValue = (n.nodeValue || '').replace(/^([\s\u00a0]*)[,.;:!?，。！？；：]+/, '$1');
      if (!n.nodeValue) n.remove();
      return;
    }
    if (n.nodeType === Node.ELEMENT_NODE) {
      const text = (n.textContent || '').trim();
      if (text && /^[,.;:!?，。！？；：]+$/.test(text)) n.remove();
    }
  }

  function cloneRangeWithMath(range, msg) {
    const records = collect(range, msg);
    const touched = [];
    records.forEach((r, i) => {
      touched.push([r.anchor, r.anchor.getAttribute('data-cgo-v120-id')]);
      r.anchor.setAttribute('data-cgo-v120-id', String(i));
    });

    let div;
    try {
      const frag = range.cloneContents();
      div = document.createElement('div');
      div.appendChild(frag);
    } finally {
      for (const [el, old] of touched) {
        if (old === null) el.removeAttribute('data-cgo-v120-id');
        else el.setAttribute('data-cgo-v120-id', old);
      }
    }

    let written = 0;
    const sourceCounts = { katex: 0, native: 0 };
    for (const holder of [...div.querySelectorAll('[data-cgo-v120-id]')]) {
      const id = Number(holder.getAttribute('data-cgo-v120-id'));
      const rec = records[id];
      if (!rec) continue;
      const math = rec.math.cloneNode(true);
      holder.replaceWith(math);
      if (rec.display) removeAdjacentDisplayPunctuation(math);
      if (rec.source === 'KaTeX source') sourceCounts.katex++;
      else sourceCounts.native++;
      written++;
    }

    div.querySelectorAll(
      'button,svg,[role="button"],#cgo-office-copy-btn,#cgo-office-toast'
    ).forEach(x => x.remove());
    return { div, found: records.length, written, sourceCounts };
  }

  function looksLikeTurn(el) {
    if (!el || el.nodeType !== 1) return false;
    const role = (el.getAttribute('data-message-author-role') || el.getAttribute('data-turn') || '').toLowerCase();
    const testid = (el.getAttribute('data-testid') || '').toLowerCase();
    return role === 'assistant' || testid.startsWith('conversation-turn') || el.tagName === 'ARTICLE';
  }

  function findMessage(node) {
    let el = node?.nodeType === 1 ? node : node?.parentElement;
    for (let i = 0; el && el !== document.body && i < 18; i++, el = el.parentElement) {
      if ((el.getAttribute?.('data-message-author-role') || '').toLowerCase() === 'assistant') {
        return el.closest('article,[data-testid^="conversation-turn"]') || el;
      }
      if (looksLikeTurn(el) && el.querySelector?.('[data-message-author-role="assistant"]')) return el;
    }
    const xs = [...document.querySelectorAll('[data-message-author-role="assistant"]')];
    return xs.length ? xs[xs.length - 1] : null;
  }

  async function writeClipboard(html, plain) {
    const item = new ClipboardItem({
      'text/html': new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob([plain], { type: 'text/plain' })
    });
    await navigator.clipboard.write([item]);
  }

  function toast(text, bad = false) {
    document.getElementById('cgo-office-toast')?.remove();
    const d = document.createElement('div');
    d.id = 'cgo-office-toast';
    d.textContent = text;
    if (bad) d.style.background = 'rgba(115,25,25,.96)';
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 6000);
  }

  async function copyBatch() {
    try {
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount || sel.isCollapsed) throw new Error('请先框选要复制的内容');
      const range = sel.getRangeAt(0).cloneRange();
      const msg = findMessage(range.commonAncestorContainer);
      if (!msg) throw new Error('未定位到 ChatGPT 回答');

      const { div, found, written, sourceCounts } = cloneRangeWithMath(range, msg);
      if (!found) throw new Error('选区中没有检测到 ChatGPT/KaTeX 公式容器');
      if (written !== found) throw new Error(`检测到 ${found} 个公式，但只写入 ${written} 个`);

      await writeClipboard(div.innerHTML, sel.toString());
      toast(
        `已复制 ${written} 个公式：KaTeX 源 ${sourceCounts.katex}，原生 MathML ${sourceCounts.native}；行间公式末尾标点已删除`
      );
    } catch (e) {
      console.error('[CGO v1.2.0]', e);
      toast(`复制失败：${e.message}`, true);
    }
  }

  function install() {
    if (document.getElementById('cgo-office-copy-btn')) return;
    const b = document.createElement('button');
    b.id = 'cgo-office-copy-btn';
    b.type = 'button';
    b.textContent = '复制整段到 Office';
    b.title = 'v1.2.0：识别新版 ChatGPT 公式容器，并使用 KaTeX 生成 Presentation MathML。';
    b.addEventListener('click', copyBatch);
    document.body.appendChild(b);
  }

  // Test hooks are intentionally small and inert in normal use.
  globalThis.__CGO_V120_TEST__ = {
    trimMathDelimiters,
    stripDisplayTrailingPunctuation,
    extractLatex,
    isDisplay,
    renderLatex,
    collect,
    cloneRangeWithMath
  };

  install();
  new MutationObserver(install).observe(document.documentElement, { childList: true, subtree: true });
})();
