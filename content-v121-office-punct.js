'use strict';

// v1.2.1 — Office-safe internal punctuation adapter.
//
// KaTeX correctly emits argument/list commas as MathML operator tokens such as
// <mo separator="true">,</mo>. Microsoft Office's MathML importer can drop some
// of those separator operators (notably inside function arguments), producing
// P(s=0t). Before the clipboard payload reaches Office, convert internal list
// punctuation to <mtext> runs. Display-equation terminal punctuation has already
// been removed by content-v120.js, so this layer only protects punctuation that
// remains inside the mathematical expression.
(function () {
  const NS = 'http://www.w3.org/1998/Math/MathML';
  const PROTECTED_PUNCT = new Set([',', ';', ':', '，', '；', '：']);

  function normalizeMathElement(math) {
    if (!math?.querySelectorAll) return math;

    for (const mo of [...math.querySelectorAll('mo')]) {
      const text = (mo.textContent || '').trim();
      if (!PROTECTED_PUNCT.has(text)) continue;

      // mtext maps to an ordinary math text run in Office and is substantially
      // more reliable than a separator operator for commas between arguments,
      // vector entries, tuple entries, and subscript components.
      const mtext = math.ownerDocument.createElementNS(NS, 'mtext');
      mtext.textContent = text;
      mtext.setAttribute('data-cgo-office-punct', '1');
      mo.replaceWith(mtext);
    }

    // Defensive cleanup: if any non-protected operator keeps KaTeX's separator
    // hint, remove the hint so Office cannot reinterpret it as an invisible
    // argument separator.
    for (const mo of [...math.querySelectorAll('mo[separator]')]) {
      mo.removeAttribute('separator');
    }
    return math;
  }

  function normalizeOfficeMathHTML(html) {
    const source = String(html || '');
    if (!source || !source.includes('<math')) return source;

    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div id="cgo-root">${source}</div>`, 'text/html');
    const root = doc.getElementById('cgo-root');
    if (!root) return source;

    for (const math of [...root.querySelectorAll('math')]) normalizeMathElement(math);
    return root.innerHTML;
  }

  async function normalizeClipboardItem(item) {
    if (!item?.types || !item.types.length) return item;
    const payload = {};
    for (const type of item.types) {
      const blob = await item.getType(type);
      if (type === 'text/html') {
        const html = await blob.text();
        payload[type] = new Blob([normalizeOfficeMathHTML(html)], { type: 'text/html' });
      } else {
        payload[type] = blob;
      }
    }
    return new ClipboardItem(payload);
  }

  function installClipboardAdapter() {
    const clipboard = navigator.clipboard;
    if (!clipboard?.write || clipboard.__cgoOfficePunctV121) return;

    const originalWrite = clipboard.write.bind(clipboard);
    const wrappedWrite = async function (items) {
      const normalized = [];
      for (const item of items || []) normalized.push(await normalizeClipboardItem(item));
      return originalWrite(normalized);
    };

    try {
      clipboard.write = wrappedWrite;
      clipboard.__cgoOfficePunctV121 = true;
    } catch (e) {
      console.error('[CGO v1.2.1] failed to install clipboard punctuation adapter', e);
    }
  }

  globalThis.__CGO_V121_TEST__ = {
    normalizeMathElement,
    normalizeOfficeMathHTML
  };

  installClipboardAdapter();
})();
