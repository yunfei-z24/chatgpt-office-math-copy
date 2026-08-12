'use strict';

// v1.0.3 compatibility fixes for simple inline math and common TeX commands.
// Loaded after content-dom.js and before content-main.js.
(function installOfficeMathCompatibilityFixes(){
  // Common set / relation symbols that previously fell back to literal command names.
  CMDS.varnothing = '∅';
  CMDS.emptyset = '∅';
  CMDS.setminus = '∖';
  CMDS.backslash = '∖';
  CMDS.land = '∧';
  CMDS.lor = '∨';
  CMDS.implies = '⇒';
  CMDS.iff = '⇔';
  CMDS.cdots = '⋯';
  CMDS.ldots = '…';
  CMDS.dots = '…';

  // Add TeX commands that should never appear as literal words in Office.
  const originalCommand = TexParser.prototype.command;
  TexParser.prototype.command = function(name){
    if(name === 'boxed') {
      // Keep the mathematical content editable and use MathML menclose for the box.
      return `<menclose notation="box">${row(this.group())}</menclose>`;
    }
    if(name === 'xrightarrow' || name === 'xleftarrow') {
      const over = this.group();
      return `<mover>${mo(name === 'xrightarrow' ? '→' : '←')}${row(over)}</mover>`;
    }
    if(name === 'overset') {
      const over = this.group(), base = this.group();
      return `<mover>${row(base)}${row(over)}</mover>`;
    }
    if(name === 'underset') {
      const under = this.group(), base = this.group();
      return `<munder>${row(base)}${row(under)}</munder>`;
    }
    if(name === 'cdots' || name === 'dots') return mo('⋯');
    if(name === 'ldots') return mo('…');
    if(name === 'varnothing' || name === 'emptyset') return mo('∅');
    return originalCommand.call(this,name);
  };

  function simpleTexLike(s='') {
    s = String(s).trim();
    if(!s || s.length > 240) return false;

    // Explicit TeX commands or ordinary sub/superscripts, including q_i and U^2.
    if(/\\[A-Za-z]+/.test(s)) return true;
    if(/(?:^|[A-Za-z0-9)\]])[_^](?:[A-Za-z0-9]|\{)/.test(s)) return true;

    // Short expressions containing mathematical Unicode are also valid candidates.
    if(/[∅∂∇∑∏∫√∞≈≠≤≥±×÷∩∪∈∉⊂⊆⊃⊇→←⇒⇔ΩΣΔεαβγδλμστωφψ]/.test(s)) return true;

    return false;
  }

  // Replace the old strict test so q_i / x_i / P_m / U^2 are accepted.
  texLike = function(s='') { return simpleTexLike(s); };

  const originalMathMLFromElement = mathMLFromElement;
  mathMLFromElement = function(el){
    const existing = originalMathMLFromElement(el);
    if(existing) return existing;
    if(!el || el.nodeType !== 1) return null;

    // Current ChatGPT sometimes puts the TeX source only in aria-label/title on a
    // generic span. The previous DOM scan could see the span but rejected q_i.
    for(const k of ['aria-label','title','data-latex','data-tex','data-math','data-expression']) {
      const v = el.getAttribute?.(k);
      if(v && simpleTexLike(v)) {
        let display = true;
        try { display = getComputedStyle(el).display !== 'inline'; } catch(_) {}
        return latexToMathML(v,display);
      }
    }
    return null;
  };

  const originalIsMathishElement = isMathishElement;
  isMathishElement = function(el){
    if(originalIsMathishElement(el)) return true;
    if(!el || el.nodeType !== 1) return false;

    const label = [el.getAttribute?.('aria-label'), el.getAttribute?.('title')]
      .filter(Boolean).join(' ').trim();
    if(label && simpleTexLike(label)) return true;

    // Fallback for generic spans used by the current renderer.
    try {
      const ff = getComputedStyle(el).fontFamily || '';
      if(/katex|mathjax|stix|cambria math|latin modern math|new computer modern math/i.test(ff)) {
        const t = (el.getAttribute?.('aria-label') || el.textContent || '').trim();
        if(t && t.length <= 120) return true;
      }
    } catch(_) {}
    return false;
  };

  // The old collector only performed a full scan when fewer than three obvious
  // math nodes existed. That caused a fourth simple inline formula such as q_i to
  // disappear. Always add relevant aria-label/math-font candidates intersecting
  // the current selection.
  const originalCollect = collectLiveFormulaRecords;
  collectLiveFormulaRecords = function(range,msg){
    const base = originalCollect(range,msg);
    const out = [...base];
    const seenAnchors = new Set(out.map(x=>x.anchor));

    let candidates=[];
    try { candidates=[...msg.querySelectorAll('[aria-label],[title],span,sub,sup')]; } catch(_) {}

    for(const el0 of candidates) {
      if(!el0 || !safeIntersects(range,el0) || !isMathishElement(el0)) continue;
      const markup = mathMLFromElement(el0);
      if(!markup) continue;
      const anchor = formulaAnchor(el0,msg) || el0;
      if(!safeIntersects(range,anchor) || seenAnchors.has(anchor)) continue;

      // Avoid adding a nested duplicate of a formula already recovered.
      const duplicate = out.some(x =>
        x.anchor === anchor ||
        (x.anchor.contains?.(anchor) || anchor.contains?.(x.anchor)) &&
        x.markup.replace(/\s+/g,'') === markup.replace(/\s+/g,'')
      );
      if(duplicate) continue;

      out.push({el:el0,anchor,markup});
      seenAnchors.add(anchor);
    }

    out.sort((a,b)=>nodeOrder(a.anchor,b.anchor));
    return out;
  };
})();
