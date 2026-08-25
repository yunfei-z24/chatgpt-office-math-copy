'use strict';

// v1.0.6: normalize the final Office math payload.
// Prefer the formula's canonical TeX source whenever it exists, and keep
// sentence punctuation outside the MathML object so Word/PowerPoint lays it
// out on the normal text baseline rather than the math axis.
(function installOfficeOutputNormalization(){
  const previousMathMLFromElement = mathMLFromElement;

  function canonicalTex(el){
    if(!el || el.nodeType !== 1) return '';

    // extractTexFromNode already checks application/x-tex annotations as well
    // as data-latex/data-tex/data-math/data-expression/aria-label/title.
    try {
      const tex = extractTexFromNode(el);
      if(tex && String(tex).trim()) return String(tex).trim();
    } catch(_) {}

    // Some current ChatGPT renderers put the annotation below a descendant
    // MathML node that is not reached by the normal selector path.
    try {
      const ann = el.querySelector?.(
        'annotation[encoding="application/x-tex"], annotation[encoding*="tex" i]'
      );
      if(ann?.textContent?.trim()) return ann.textContent.trim();
    } catch(_) {}
    return '';
  }

  function splitTrailingSentencePunctuation(tex){
    let body = String(tex || '').trim();
    let punctuation = '';

    // Only strip punctuation at the very end of the complete expression.
    // Commas inside P(s=0,t), vectors, tuples, subscripts etc. are untouched.
    while(body && /[,.!?;:，。！？；：]$/.test(body)) {
      punctuation = body.slice(-1) + punctuation;
      body = body.slice(0,-1).trimEnd();
    }
    return {body, punctuation};
  }

  function mathDisplayMode(el){
    try {
      const tag=(el.tagName || '').toLowerCase();
      if(tag === 'math') return (el.getAttribute('display') || '').toLowerCase() === 'block';
      const d=getComputedStyle(el).display || '';
      return !/^inline/.test(d) && d !== 'contents';
    } catch(_) { return false; }
  }

  function externalPunctuationMarkup(mathml, punctuation, display){
    if(!punctuation) return mathml;
    const p=esc(punctuation);

    // Wrapper is deliberately ordinary HTML. Office sees one editable MathML
    // object followed by ordinary punctuation; punctuation is no longer placed
    // on the mathematical axis.
    if(display) {
      return `<div data-cgo-office-math="block" style="text-align:center">${mathml}<span data-cgo-punctuation="true">${p}</span></div>`;
    }
    return `<span data-cgo-office-math="inline">${mathml}<span data-cgo-punctuation="true">${p}</span></span>`;
  }

  mathMLFromElement = function(el){
    const tex = canonicalTex(el);
    if(tex) {
      const {body,punctuation}=splitTrailingSentencePunctuation(tex);
      if(body) {
        const display=mathDisplayMode(el);
        const mathml=latexToMathML(body,display);
        return externalPunctuationMarkup(mathml,punctuation,display);
      }
    }

    // No canonical TeX source: retain the v1.0.5 whole-inline fallback.
    return previousMathMLFromElement(el);
  };
})();
