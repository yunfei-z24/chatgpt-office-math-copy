'use strict';

// v1.0.5: recover WHOLE inline formulas instead of converting punctuation/tokens
// one by one. This prevents Office paste artefacts such as misplaced commas,
// split variables and multiple adjacent math objects for one inline expression.
(function installInlineMathAndAccentFixes(){
  const prevCommand = TexParser.prototype.command;
  TexParser.prototype.command = function(name){
    if(name === 'dot')  return `<mover accent="true">${row(this.group())}${mo('\u0307')}</mover>`;
    if(name === 'ddot') return `<mover accent="true">${row(this.group())}${mo('\u0308')}</mover>`;
    if(name === 'acute') return `<mover accent="true">${row(this.group())}${mo('\u0301')}</mover>`;
    if(name === 'grave') return `<mover accent="true">${row(this.group())}${mo('\u0300')}</mover>`;
    if(name === 'tilde' || name === 'widetilde') return `<mover accent="true">${row(this.group())}${mo('\u0303')}</mover>`;
    if(name === 'check') return `<mover accent="true">${row(this.group())}${mo('\u030c')}</mover>`;
    if(name === 'breve') return `<mover accent="true">${row(this.group())}${mo('\u0306')}</mover>`;
    return prevCommand.call(this,name);
  };

  const SUB = {'₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9',
    'ₐ':'a','ₑ':'e','ₕ':'h','ᵢ':'i','ⱼ':'j','ₖ':'k','ₗ':'l','ₘ':'m','ₙ':'n','ₒ':'o','ₚ':'p','ᵣ':'r','ₛ':'s','ₜ':'t','ᵤ':'u','ᵥ':'v','ₓ':'x'};
  const SUP = {'⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9','ⁿ':'n','ⁱ':'i'};

  function mapRun(run,map){ return [...run].map(c=>map[c] ?? c).join(''); }

  function visibleToTex(s=''){
    s=String(s).replace(/\u00a0/g,' ').trim()
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
    return s.replace(/−/g,'-').replace(/\s+/g,' ');
  }

  function mathFont(el){
    try {
      return /katex|mathjax|mjx|stix|cambria math|latin modern|computer modern|asana math|libertinus math|xits math/i
        .test(getComputedStyle(el).fontFamily || '');
    } catch(_) { return false; }
  }

  function visibleText(el){
    if(!el || el.nodeType!==1) return '';
    const s=(el.innerText || el.textContent || '').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
    if(!s || s.length>260 || /[\u3400-\u9fff]/.test(s)) return '';
    return s;
  }

  function explicitMathContainer(el){
    if(!el || el.nodeType!==1) return false;
    const tag=(el.tagName||'').toLowerCase();
    if(tag==='math' || tag==='mjx-container') return true;
    const role=(el.getAttribute?.('role')||'').toLowerCase();
    if(role==='math') return true;
    const cls=(typeof el.className==='string' ? el.className : '').toLowerCase();
    const testid=(el.getAttribute?.('data-testid')||'').toLowerCase();
    if(/katex|mathjax|mjx|equation|formula|latex|math/.test(cls+' '+testid)) return true;
    for(const k of ['data-latex','data-tex','data-math','data-expression']) if(el.hasAttribute?.(k)) return true;
    return false;
  }

  function punctuationOnly(s=''){
    // Never create a separate Office Math object for commas, brackets, equals,
    // colons, etc. They must remain inside the whole formula object.
    return /^[\s,.;:()[\]{}=+\-−*/×÷|]+$/.test(String(s));
  }

  function hasSemanticAtom(s=''){
    return /[A-Za-z0-9Α-Ωα-ω∂∇∫∑√∞∅]|[₀₁₂₃₄₅₆₇₈₉ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓ⁰¹²³⁴⁵⁶⁷⁸⁹ⁿⁱ]|\\[A-Za-z]+|\u0307|\u0308/.test(String(s));
  }

  function mathSignal(s=''){
    s=String(s).trim();
    if(!s || punctuationOnly(s)) return false;
    if(/\\[A-Za-z]+|[_^]/.test(s)) return true;
    if(/[∅∂∇∑∏∫√∞≈≠≤≥±×÷∩∪∈∉⊂⊆⊃⊇→←⇒⇔]/.test(s)) return true;
    // Ordinary inline expression such as P(s=0,t), d=0.1 m, q_i.
    return hasSemanticAtom(s) && /[=+\-−*/×÷()[\]{},;:]/.test(s);
  }

  function inlineCandidate(el){
    if(!el || el.nodeType!==1) return false;
    const tag=(el.tagName || '').toLowerCase();
    if(!['span','i','em','var','sub','sup'].includes(tag) && !explicitMathContainer(el)) return false;
    const s=visibleText(el);
    if(!s || punctuationOnly(s) || !hasSemanticAtom(s)) return false;
    return explicitMathContainer(el) || mathFont(el) || tag==='var' || tag==='sub' || tag==='sup' || mathSignal(s);
  }

  function safeInlineDisplay(el){
    try {
      const d=getComputedStyle(el).display || '';
      return /^inline/.test(d) || d==='contents';
    } catch(_) { return true; }
  }

  function wholeInlineAnchor(el,msg){
    let best=el;
    let p=el?.parentElement;
    for(let depth=0;p && p!==msg && depth<7;depth++,p=p.parentElement){
      const s=visibleText(p);
      if(!s || punctuationOnly(s) || !hasSemanticAtom(s)) break;
      if(/[\u3400-\u9fff]/.test(s)) break;

      const explicit=explicitMathContainer(p);
      if(!explicit && !safeInlineDisplay(p)) break;
      if(!explicit && !(mathFont(p) || mathSignal(s))) break;

      // Do not absorb a long prose-like English sentence merely because it
      // contains one variable. Whole formula wrappers are compact.
      const words=(s.match(/[A-Za-z]{3,}/g)||[]).length;
      if(!explicit && s.length>180 && words>5) break;
      best=p;
    }
    return best;
  }

  function texFromVisibleTree(node){
    if(!node) return '';
    if(node.nodeType===Node.TEXT_NODE) return visibleToTex(node.nodeValue || '');
    if(node.nodeType!==1) return '';
    const el=node;
    if(el.getAttribute?.('aria-hidden')==='true') return '';
    const tag=(el.tagName||'').toLowerCase();
    if(tag==='annotation') return '';

    // Prefer an explicit TeX source when this element owns the complete formula.
    for(const k of ['data-latex','data-tex','data-math','data-expression','aria-label']) {
      const v=el.getAttribute?.(k);
      if(v && (texLike(v) || mathSignal(v))) return String(v).trim();
    }

    let inner='';
    for(const ch of el.childNodes) inner+=texFromVisibleTree(ch);
    if(tag==='sub') return `_{${inner}}`;
    if(tag==='sup') return `^{${inner}}`;
    return inner;
  }

  function structuredMathMarkup(el){
    if(!el || el.nodeType!==1) return null;
    if((el.tagName||'').toLowerCase()==='math') {
      const c=el.cloneNode(true); c.setAttribute('xmlns',NS); return c.outerHTML;
    }
    let maths=[];
    try { maths=[...el.querySelectorAll('math')].filter(m=>!m.parentElement?.closest('math')); } catch(_) {}
    if(maths.length===1) {
      const c=maths[0].cloneNode(true); c.setAttribute('xmlns',NS); return c.outerHTML;
    }
    const tex=extractTexFromNode(el);
    if(tex && (texLike(tex) || mathSignal(tex))) {
      let display=false; try { display=!/^inline/.test(getComputedStyle(el).display||''); } catch(_) {}
      return latexToMathML(tex,display);
    }
    return null;
  }

  const prevMathML = mathMLFromElement;
  mathMLFromElement = function(el){
    const direct=structuredMathMarkup(el);
    if(direct) return direct;

    const hit=prevMathML(el);
    if(hit && explicitMathContainer(el)) return hit;
    if(!inlineCandidate(el)) return null;

    const anchorText=visibleText(el);
    if(!anchorText || punctuationOnly(anchorText)) return null;
    let tex=texFromVisibleTree(el).trim();
    if(!tex) tex=visibleToTex(anchorText);
    if(!tex || punctuationOnly(tex)) return null;

    let display=false;
    try { display=!/^inline/.test(getComputedStyle(el).display || ''); } catch(_) {}
    return latexToMathML(tex,display);
  };

  const prevMathish=isMathishElement;
  isMathishElement=function(el){
    return prevMathish(el) || inlineCandidate(el);
  };

  const prevCollect=collectLiveFormulaRecords;
  collectLiveFormulaRecords=function(range,msg){
    let out=[...prevCollect(range,msg)];
    let candidates=[];
    try { candidates=[...msg.querySelectorAll('span,i,em,var,sub,sup,[aria-label],[title],[role="math"]')]; } catch(_) {}

    for(const el of candidates){
      if(!safeIntersects(range,el) || !inlineCandidate(el)) continue;
      const anchor=wholeInlineAnchor(el,msg);
      if(!anchor || !safeIntersects(range,anchor)) continue;
      const s=visibleText(anchor);
      if(!s || punctuationOnly(s)) continue;

      // If a larger safe anchor contains token-level records, replace those
      // records with ONE MathML object for the whole inline formula.
      const contained=out.filter(r=>anchor===r.anchor || anchor.contains?.(r.anchor));
      const covering=out.find(r=>r.anchor!==anchor && r.anchor.contains?.(anchor));
      if(covering) continue;

      const markup=mathMLFromElement(anchor) || mathMLFromElement(el);
      if(!markup) continue;

      if(contained.length){
        out=out.filter(r=>!(anchor===r.anchor || anchor.contains?.(r.anchor)));
      }

      if(!out.some(r=>r.anchor===anchor)) out.push({el,anchor,markup});
    }

    // Final safety pass: remove nested duplicates so punctuation cannot become
    // separate Office Math objects beside an already recovered whole formula.
    out.sort((a,b)=>nodeOrder(a.anchor,b.anchor));
    const final=[];
    for(const rec of out){
      if(final.some(x=>x.anchor===rec.anchor || x.anchor.contains?.(rec.anchor))) continue;
      for(let i=final.length-1;i>=0;i--){
        if(rec.anchor.contains?.(final[i].anchor)) final.splice(i,1);
      }
      final.push(rec);
    }
    final.sort((a,b)=>nodeOrder(a.anchor,b.anchor));
    return final;
  };
})();
