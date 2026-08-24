'use strict';

// v1.0.4: recover inline math from the visible renderer and add TeX accents.
// Loaded after content-fixes.js and before content-main.js.
(function installInlineMathAndAccentFixes(){
  const prevCommand = TexParser.prototype.command;
  TexParser.prototype.command = function(name){
    if(name === 'dot')  return `<mover accent="true">${row(this.group())}${mo('˙')}</mover>`;
    if(name === 'ddot') return `<mover accent="true">${row(this.group())}${mo('¨')}</mover>`;
    if(name === 'acute') return `<mover accent="true">${row(this.group())}${mo('´')}</mover>`;
    if(name === 'grave') return `<mover accent="true">${row(this.group())}${mo('`')}</mover>`;
    if(name === 'tilde' || name === 'widetilde') return `<mover accent="true">${row(this.group())}${mo('˜')}</mover>`;
    if(name === 'check') return `<mover accent="true">${row(this.group())}${mo('ˇ')}</mover>`;
    if(name === 'breve') return `<mover accent="true">${row(this.group())}${mo('˘')}</mover>`;
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
      return /katex|mathjax|mjx|stix|cambria math|latin modern|computer modern|asana math|libertinus math|xits math|math/i
        .test(getComputedStyle(el).fontFamily || '');
    } catch(_) { return false; }
  }

  function visibleText(el){
    if(!el || el.nodeType!==1) return '';
    const s=(el.innerText || el.textContent || '').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
    if(!s || s.length>160 || /[\u3400-\u9fff]/.test(s)) return '';
    return s;
  }

  function mathSignal(s=''){
    return /\\[A-Za-z]+|[_^]|[=+\-−*/×÷∩∪∈∉≠≤≥≈→←⇒⇔()[\]{},;:∂∇∫∑√∞∅]|[₀₁₂₃₄₅₆₇₈₉ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓ⁰¹²³⁴⁵⁶⁷⁸⁹ⁿⁱ]|\u0307|\u0308/.test(s);
  }

  function inlineCandidate(el){
    if(!el || el.nodeType!==1) return false;
    const tag=(el.tagName || '').toLowerCase();
    if(!['span','i','em','var','sub','sup'].includes(tag)) return false;
    const s=visibleText(el);
    if(!s) return false;
    return mathFont(el) || tag==='var' || tag==='sub' || tag==='sup' || mathSignal(s);
  }

  const prevMathML = mathMLFromElement;
  mathMLFromElement = function(el){
    const hit=prevMathML(el);
    if(hit) return hit;
    if(!inlineCandidate(el)) return null;

    const s=visibleText(el);
    let display=false;
    try { display=!/^inline/.test(getComputedStyle(el).display || ''); } catch(_) {}
    return latexToMathML(visibleToTex(s),display);
  };

  const prevMathish=isMathishElement;
  isMathishElement=function(el){
    return prevMathish(el) || inlineCandidate(el);
  };

  function outerInline(el,msg){
    let best=el, p=el?.parentElement;
    for(let i=0;p && p!==msg && i<4;i++,p=p.parentElement){
      const tag=(p.tagName || '').toLowerCase();
      if(!['span','i','em','var'].includes(tag)) break;
      const s=visibleText(p);
      if(!s) break;
      let d='';
      try { d=getComputedStyle(p).display || ''; } catch(_) {}
      if(d && !/^inline/.test(d)) break;
      if(mathFont(p) || mathSignal(s)) best=p; else break;
    }
    return best;
  }

  const prevCollect=collectLiveFormulaRecords;
  collectLiveFormulaRecords=function(range,msg){
    const out=[...prevCollect(range,msg)];
    const baseCount=out.length;
    let candidates=[];
    try { candidates=[...msg.querySelectorAll('span,i,em,var,sub,sup,[aria-label],[title]')]; } catch(_) {}

    for(const el of candidates){
      if(!safeIntersects(range,el) || !inlineCandidate(el)) continue;
      const anchor=outerInline(el,msg);
      if(!anchor || !safeIntersects(range,anchor)) continue;

      if(out.some(r=>r.anchor===anchor || r.anchor.contains?.(anchor))) continue;

      const markup=mathMLFromElement(anchor) || mathMLFromElement(el);
      if(!markup) continue;

      for(let i=out.length-1;i>=baseCount;i--){
        if(anchor.contains?.(out[i].anchor)) out.splice(i,1);
      }
      if(out.some(r=>r.anchor===anchor)) continue;
      out.push({el,anchor,markup});
    }
    out.sort((a,b)=>nodeOrder(a.anchor,b.anchor));
    return out;
  };
})();
