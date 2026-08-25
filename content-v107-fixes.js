'use strict';

// v1.0.7: punctuation-preserving Office Math fixes.
// - Do not externalize block-equation punctuation.
// - Prefer visible text for simple inline formulas when ARIA loses punctuation.
// - Remove duplicated punctuation left beside a MathML object.
// - Move trailing punctuation beside block math into the MathML object itself.
(function installV107OfficeMathFixes(){
  const prevMathMLFromElement = mathMLFromElement;
  const prevCloneSelectionWithLiveMath = cloneSelectionWithLiveMath;

  const SUB = {'₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9',
    'ₐ':'a','ₑ':'e','ₕ':'h','ᵢ':'i','ⱼ':'j','ₖ':'k','ₗ':'l','ₘ':'m','ₙ':'n','ₒ':'o','ₚ':'p','ᵣ':'r','ₛ':'s','ₜ':'t','ᵤ':'u','ᵥ':'v','ₓ':'x'};
  const SUP = {'⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9','ⁿ':'n','ⁱ':'i'};

  function mapRun(run,map){ return [...run].map(c=>map[c] ?? c).join(''); }

  function visibleTex(s=''){
    s=String(s).replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim()
      .replace(/([A-Za-zΑ-Ωα-ω])\u0307/g,'\\dot{$1}')
      .replace(/([A-Za-zΑ-Ωα-ω])\u0308/g,'\\ddot{$1}');
    s=s.replace(/[₀₁₂₃₄₅₆₇₈₉ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓ]+/g,m=>`_{${mapRun(m,SUB)}}`);
    s=s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹ⁿⁱ]+/g,m=>`^{${mapRun(m,SUP)}}`);
    const map=[['∅','\\varnothing'],['∩','\\cap'],['∪','\\cup'],['∈','\\in'],['∉','\\notin'],
      ['≠','\\neq'],['≤','\\le'],['≥','\\ge'],['≈','\\approx'],['→','\\to'],['←','\\leftarrow'],
      ['⇒','\\Rightarrow'],['⇔','\\Leftrightarrow'],['×','\\times'],['÷','\\div'],['±','\\pm'],
      ['∞','\\infty'],['∂','\\partial'],['∇','\\nabla'],['∫','\\int'],['∑','\\sum'],
      ['Ω','\\Omega'],['ω','\\omega'],['Σ','\\Sigma'],['σ','\\sigma'],['Δ','\\Delta'],['δ','\\delta'],
      ['α','\\alpha'],['β','\\beta'],['γ','\\gamma'],['ε','\\epsilon'],['λ','\\lambda'],['μ','\\mu'],
      ['τ','\\tau'],['φ','\\phi'],['ψ','\\psi']];
    for(const [a,b] of map) s=s.split(a).join(b);
    return s.replace(/−/g,'-');
  }

  function visibleText(el){
    if(!el || el.nodeType!==1) return '';
    const s=(el.innerText || el.textContent || '').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
    if(!s || s.length>280 || /[\u3400-\u9fff]/.test(s)) return '';
    return s;
  }

  function reliableTex(el){
    if(!el || el.nodeType!==1) return '';
    try {
      const ann=el.querySelector?.('annotation[encoding="application/x-tex"],annotation[encoding*="tex" i]');
      if(ann?.textContent?.trim()) return ann.textContent.trim();
    } catch(_) {}
    for(const k of ['data-latex','data-tex','data-math','data-expression']) {
      const v=el.getAttribute?.(k);
      if(v?.trim()) return v.trim();
    }
    return '';
  }

  function hasStructuralMath(el){
    if(!el || el.nodeType!==1) return false;
    if((el.tagName||'').toLowerCase()==='math') return true;
    try { if(el.querySelector?.('math,mfrac,msqrt,mtable')) return true; } catch(_) {}
    return false;
  }

  function isSimpleVisibleFormula(s=''){
    s=String(s).trim();
    if(!s || /[\u3400-\u9fff]/.test(s) || s.length>220) return false;
    if(!/[A-Za-zΑ-Ωα-ω0-9]/.test(s)) return false;
    // Function calls, vectors, assignments, simple scripts and relations are safe
    // to reconstruct from visible text; fractions/matrices are handled structurally.
    return /[=(),\[\]{}]|[₀₁₂₃₄₅₆₇₈₉⁰¹²³⁴⁵⁶⁷⁸⁹]|[∩∪∈∉≠≤≥≈]/.test(s);
  }

  function displayMode(el){
    try {
      if((el.tagName||'').toLowerCase()==='math') return (el.getAttribute('display')||'').toLowerCase()==='block';
      const d=getComputedStyle(el).display || '';
      return !/^inline/.test(d) && d!=='contents';
    } catch(_) { return false; }
  }

  mathMLFromElement=function(el){
    // 1) Existing semantic MathML is always safest.
    if(hasStructuralMath(el)) {
      const hit=prevMathMLFromElement(el);
      if(hit) return hit;
    }

    // 2) Trust real TeX annotations/data attributes, but not ARIA/title here.
    const tex=reliableTex(el);
    if(tex) return latexToMathML(tex,displayMode(el));

    // 3) Current ChatGPT ARIA sometimes drops commas. For simple inline formulas,
    // reconstruct from the text the user actually sees on screen.
    const visible=visibleText(el);
    if(isSimpleVisibleFormula(visible)) {
      return latexToMathML(visibleTex(visible),displayMode(el));
    }

    return prevMathMLFromElement(el);
  };

  function lastMathRow(math){
    if(!math) return null;
    try {
      const sem=math.querySelector(':scope > semantics');
      if(sem) {
        const row=sem.querySelector(':scope > mrow');
        if(row) return row;
      }
      return math.querySelector('mrow') || math;
    } catch(_) { return math; }
  }

  function mathTerminalPunctuation(math){
    const t=(math?.textContent || '').trim();
    const m=t.match(/([,.!?;:，。！？；：])$/);
    return m ? m[1] : '';
  }

  function nextPunctuationText(math){
    let node=math?.nextSibling;
    while(node && node.nodeType===Node.TEXT_NODE && node.nodeValue==='' ) node=node.nextSibling;
    if(node?.nodeType===Node.TEXT_NODE) {
      const m=(node.nodeValue || '').match(/^\s*([,.!?;:，。！？；：])/);
      return m ? {node,ch:m[1]} : null;
    }
    if(node?.nodeType===1 && node.getAttribute?.('data-cgo-punctuation')==='true') {
      const t=(node.textContent||'').trim();
      if(t) return {node,ch:t[0]};
    }
    return null;
  }

  function removeLeadingPunctuation(rec){
    if(!rec?.node) return;
    if(rec.node.nodeType===Node.TEXT_NODE) {
      const re=new RegExp(`^(\\s*)${rec.ch.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}`);
      rec.node.nodeValue=(rec.node.nodeValue||'').replace(re,'$1');
      if(!(rec.node.nodeValue||'')) rec.node.remove();
    } else {
      const t=rec.node.textContent || '';
      rec.node.textContent=t.replace(rec.ch,'');
      if(!rec.node.textContent) rec.node.remove();
    }
  }

  function appendPunctuationToMath(math,ch){
    const row=lastMathRow(math);
    if(!row) return;
    const op=document.createElementNS(NS,'mo');
    op.textContent=ch;
    row.appendChild(op);
  }

  function normalizePunctuation(root){
    const maths=[...root.querySelectorAll('math')];
    for(const math of maths){
      const outside=nextPunctuationText(math);
      if(!outside) continue;
      const inside=mathTerminalPunctuation(math);

      if(inside===outside.ch) {
        // Same punctuation exists both in MathML and cloned HTML: keep one.
        removeLeadingPunctuation(outside);
        continue;
      }

      const display=(math.getAttribute('display')||'').toLowerCase()==='block';
      if(display) {
        // A punctuation mark after display math would otherwise become its own
        // PowerPoint line. Move it into the editable Office Math object.
        appendPunctuationToMath(math,outside.ch);
        removeLeadingPunctuation(outside);
      }
    }
  }

  cloneSelectionWithLiveMath=function(range,msg){
    const result=prevCloneSelectionWithLiveMath(range,msg);
    normalizePunctuation(result.div);
    return result;
  };
})();
