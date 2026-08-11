'use strict';

const NS = 'http://www.w3.org/1998/Math/MathML';
const GREEK = {
  alpha:'α', beta:'β', gamma:'γ', delta:'δ', epsilon:'ε', varepsilon:'ϵ', zeta:'ζ', eta:'η', theta:'θ', vartheta:'ϑ',
  iota:'ι', kappa:'κ', lambda:'λ', mu:'μ', nu:'ν', xi:'ξ', pi:'π', varpi:'ϖ', rho:'ρ', varrho:'ϱ', sigma:'σ', varsigma:'ς',
  tau:'τ', upsilon:'υ', phi:'φ', varphi:'ϕ', chi:'χ', psi:'ψ', omega:'ω',
  Gamma:'Γ', Delta:'Δ', Theta:'Θ', Lambda:'Λ', Xi:'Ξ', Pi:'Π', Sigma:'Σ', Upsilon:'Υ', Phi:'Φ', Psi:'Ψ', Omega:'Ω'
};
const CMDS = {
  partial:'∂', nabla:'∇', cdot:'·', times:'×', pm:'±', mp:'∓', le:'≤', leq:'≤', ge:'≥', geq:'≥', neq:'≠', approx:'≈',
  sim:'∼', to:'→', rightarrow:'→', leftarrow:'←', Leftrightarrow:'⇔', Rightarrow:'⇒', Leftarrow:'⇐', infty:'∞',
  int:'∫', iint:'∬', iiint:'∭', oint:'∮', sum:'∑', prod:'∏', lim:'lim', exp:'exp', ln:'ln', log:'log', sin:'sin', cos:'cos', tan:'tan',
  div:'÷', pmatrix:'', quad:' ', qquad:' ', ell:'ℓ', hbar:'ℏ', degree:'°', prime:'′', lVert:'‖', rVert:'‖', vert:'|', mid:'∣',
  in:'∈', notin:'∉', subset:'⊂', subseteq:'⊆', superset:'⊃', supseteq:'⊇', cup:'∪', cap:'∩', forall:'∀', exists:'∃'
};

function esc(s='') { return s.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }
function attrEsc(s='') { return s.replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c] || c)); }
function mathTag(inner, display=true) { return `<math xmlns="${NS}" display="${display ? 'block':'inline'}"><semantics>${inner}</semantics></math>`; }
function row(x) { return `<mrow>${x}</mrow>`; }
function mi(x, variant='') { return `<mi${variant?` mathvariant="${variant}"`:''}>${esc(x)}</mi>`; }
function mn(x) { return `<mn>${esc(x)}</mn>`; }
function mo(x) { return `<mo>${esc(x)}</mo>`; }
function mtext(x) { return `<mtext>${esc(x)}</mtext>`; }

class TexParser {
  constructor(s) { this.s=s; this.i=0; }
  eof(){ return this.i>=this.s.length; }
  peek(){ return this.s[this.i]; }
  next(){ return this.s[this.i++]; }
  skipSpace(){ while(!this.eof() && /\s/.test(this.peek())) this.i++; }
  parse(stop='') {
    let out='';
    while(!this.eof()) {
      if(stop && this.peek()===stop) { this.i++; break; }
      if(this.s.startsWith('\\\\', this.i)) { this.i+=2; out += '<mspace linebreak="newline"/>'; continue; }
      let atom=this.atom();
      this.skipSpace();
      let sub=null, sup=null;
      while(this.peek()==='_' || this.peek()==='^') {
        const kind=this.next(); this.skipSpace(); const a=this.scriptArg();
        if(kind==='_') sub=a; else sup=a;
        this.skipSpace();
      }
      if(sub!==null && sup!==null) atom=`<msubsup>${atom}${row(sub)}${row(sup)}</msubsup>`;
      else if(sub!==null) atom=`<msub>${atom}${row(sub)}</msub>`;
      else if(sup!==null) atom=`<msup>${atom}${row(sup)}</msup>`;
      out += atom;
    }
    return out;
  }
  scriptArg(){
    if(this.peek()==='{') { this.i++; return this.parse('}'); }
    return this.atom();
  }
  group(){ this.skipSpace(); if(this.peek()==='{'){ this.i++; return this.parse('}'); } return this.atom(); }
  readCommand(){ this.i++; let name=''; while(!this.eof() && /[A-Za-z]/.test(this.peek())) name+=this.next(); if(!name && !this.eof()) name=this.next(); return name; }
  atom(){
    if(this.eof()) return '';
    const c=this.peek();
    if(/\s/.test(c)){ this.skipSpace(); return '<mspace width="0.18em"/>'; }
    if(c==='{'){ this.i++; return row(this.parse('}')); }
    if(c==='\\') return this.command(this.readCommand());
    if(/[0-9.]/.test(c)){ let t=''; while(!this.eof() && /[0-9.eE+-]/.test(this.peek())) { if((this.peek()==='+'||this.peek()==='-') && !/[eE]$/.test(t)) break; t+=this.next(); } return mn(t); }
    if(/[A-Za-z]/.test(c)){ let t=this.next(); return mi(t); }
    this.i++; return mo(c);
  }
  command(name){
    if(name==='frac' || name==='dfrac' || name==='tfrac') { const a=this.group(), b=this.group(); return `<mfrac>${row(a)}${row(b)}</mfrac>`; }
    if(name==='sqrt') { return `<msqrt>${row(this.group())}</msqrt>`; }
    if(name==='text' || name==='textrm') { return mtext(this.rawGroup()); }
    if(name==='operatorname') { return mi(this.rawGroup(), 'normal'); }
    if(name==='mathrm' || name==='rm') { return `<mstyle mathvariant="normal">${row(this.group())}</mstyle>`; }
    if(name==='mathbf' || name==='boldsymbol') { return `<mstyle mathvariant="bold">${row(this.group())}</mstyle>`; }
    if(name==='mathit') { return `<mstyle mathvariant="italic">${row(this.group())}</mstyle>`; }
    if(name==='mathcal') { return `<mstyle mathvariant="script">${row(this.group())}</mstyle>`; }
    if(name==='mathbb') { return `<mstyle mathvariant="double-struck">${row(this.group())}</mstyle>`; }
    if(name==='overline' || name==='bar') { return `<mover>${row(this.group())}${mo('¯')}</mover>`; }
    if(name==='hat' || name==='widehat') { return `<mover>${row(this.group())}${mo('ˆ')}</mover>`; }
    if(name==='vec' || name==='overrightarrow') { return `<mover>${row(this.group())}${mo('→')}</mover>`; }
    if(name==='underline') { return `<munder>${row(this.group())}${mo('_')}</munder>`; }
    if(name==='left' || name==='right') { this.skipSpace(); if(this.peek()==='\\') return this.command(this.readCommand()); const x=this.eof()?'':this.next(); return mo(x==='.'?'':x); }
    if(name==='begin') { const env=this.rawGroup(); return this.environment(env); }
    if(name===',' || name===';' || name===':' || name==='!' || name===' ') return '<mspace width="0.18em"/>';
    if(GREEK[name]) return mi(GREEK[name]);
    if(CMDS[name]!==undefined) {
      const v=CMDS[name];
      if(['lim','exp','ln','log','sin','cos','tan'].includes(name)) return mi(v,'normal');
      return mo(v);
    }
    return mi(name, 'normal');
  }
  rawGroup(){
    this.skipSpace(); if(this.peek()!=='{') return '';
    this.i++; let d=1, out='';
    while(!this.eof() && d){ const c=this.next(); if(c==='{') d++; else if(c==='}') { d--; if(!d) break; } if(d) out+=c; }
    return out;
  }
  environment(env){
    const end=`\\end{${env}}`; const j=this.s.indexOf(end,this.i); const body=j>=0?this.s.slice(this.i,j):this.s.slice(this.i); this.i=j>=0?j+end.length:this.s.length;
    if(/^(aligned|align|align\*|gather|gather\*)$/.test(env)) {
      const lines=body.split(/\\\\/).map(x=>x.replace(/&/g,''));
      return `<mtable>${lines.map(x=>`<mtr><mtd>${row(new TexParser(x).parse())}</mtd></mtr>`).join('')}</mtable>`;
    }
    if(/^(matrix|pmatrix|bmatrix|Bmatrix|vmatrix|Vmatrix|cases)$/.test(env)) {
      const lines=body.split(/\\\\/);
      const table=`<mtable>${lines.map(line=>`<mtr>${line.split('&').map(x=>`<mtd>${row(new TexParser(x).parse())}</mtd>`).join('')}</mtr>`).join('')}</mtable>`;
      const fences={pmatrix:['(',')'],bmatrix:['[',']'],Bmatrix:['{','}'],vmatrix:['|','|'],Vmatrix:['‖','‖'],cases:['{','']};
      if(fences[env]) return `<mrow>${mo(fences[env][0])}${table}${mo(fences[env][1])}</mrow>`;
      return table;
    }
    return row(new TexParser(body.replace(/&/g,'')).parse());
  }
}

function latexToMathML(tex, display=true) {
  tex = tex.trim().replace(/^\$\$|\$\$$/g,'').replace(/^\\\[|\\\]$/g,'').replace(/^\\\(|\\\)$/g,'');
  const p=new TexParser(tex);
  const body=p.parse();
  return `<math xmlns="${NS}" display="${display?'block':'inline'}"><semantics><mrow>${body}</mrow><annotation encoding="application/x-tex">${esc(tex)}</annotation></semantics></math>`;
}

function extractTexFromNode(el) {
  if(!el || el.nodeType!==1) return null;
  const ann=el.querySelector?.('annotation[encoding="application/x-tex"], annotation[encoding*="tex" i]');
  if(ann?.textContent?.trim()) return ann.textContent.trim();
  for(const k of ['data-latex','data-tex','data-math','data-expression','aria-label','title']) {
    const v=el.getAttribute?.(k);
    if(v && (/\\[A-Za-z]+|\^|_|\\frac|\\partial|\\begin/.test(v))) return v;
  }
  const html=el.innerHTML || '';
  const m=html.match(/annotation[^>]*application\/x-tex[^>]*>([\s\S]*?)<\/annotation>/i);
  if(m) return m[1].replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
  return null;
}

const mathSelectors = [
  'math','mjx-container','.katex','.katex-display','[data-latex]','[data-tex]','[data-math]','[data-expression]',
  '[class*="math" i]','[class*="latex" i]','[class*="equation" i]','[aria-label*="\\frac"]','[aria-label*="\\partial"]'
].join(',');

function normalizeMathInClone(root, sourceRoot) {
  let n=0;
  const nodes=[...root.querySelectorAll(mathSelectors)];
  const seen=new Set();
  for(const node of nodes) {
    if(seen.has(node) || node.closest('math') && node.tagName.toLowerCase()!=='math') continue;
    seen.add(node);
    let replacement='';
    if(node.tagName.toLowerCase()==='math') {
      const clone=node.cloneNode(true); clone.setAttribute('xmlns',NS); replacement=clone.outerHTML;
    } else {
      const tex=extractTexFromNode(node);
      if(tex) replacement=latexToMathML(tex, getComputedStyle(node).display!=='inline');
      else {
        const innerMath=node.querySelector?.('math');
        if(innerMath){ const c=innerMath.cloneNode(true); c.setAttribute('xmlns',NS); replacement=c.outerHTML; }
      }
    }
    if(replacement) {
      const span=document.createElement('span'); span.innerHTML=replacement; node.replaceWith(span.firstElementChild); n++;
    }
  }
  return n;
}

function selectionFragment() {
  const sel=window.getSelection();
  if(!sel || sel.rangeCount===0 || sel.isCollapsed) return null;
  const range=sel.getRangeAt(0); const frag=range.cloneContents();
  const div=document.createElement('div'); div.appendChild(frag); return {div, range};
}

function looksLikeTurn(el) {
  if(!el || el.nodeType!==1) return false;
  const role=(el.getAttribute('data-message-author-role')||el.getAttribute('data-turn')||'').toLowerCase();
  const testid=(el.getAttribute('data-testid')||'').toLowerCase();
  if(role==='assistant') return true;
  if(testid.startsWith('conversation-turn')) return true;
  if(el.tagName==='ARTICLE') return true;
  return false;
}

function hasCopyButton(el) {
  if(!el?.querySelectorAll) return false;
  return [...el.querySelectorAll('button')].some(b => {
    const s=[b.getAttribute('aria-label'),b.getAttribute('title'),b.getAttribute('data-testid'),b.textContent]
      .filter(Boolean).join(' ');
    return /(^|\s)(copy|复制)(\s|$)|copy-turn|copy-message/i.test(s);
  });
}

function expandToTurn(el) {
  if(!el) return null;
  let cur=el.nodeType===1 ? el : el.parentElement;
  let fallback=null;
  for(let depth=0; cur && cur!==document.body && depth<14; depth++, cur=cur.parentElement) {
    if(looksLikeTurn(cur)) fallback=cur;
    if((fallback || cur.querySelector?.('[data-message-author-role="assistant"]')) && hasCopyButton(cur)) return cur;
  }
  return fallback || (el.nodeType===1 ? el : el.parentElement);
}

function findMessageFromNode(node) {
  if(!node) return null;
  let el=node.nodeType===1 ? node : node.parentElement;
  for(let depth=0; el && el!==document.body && depth<16; depth++, el=el.parentElement) {
    const role=(el.getAttribute?.('data-message-author-role')||'').toLowerCase();
    if(role==='assistant') return expandToTurn(el);
    if(looksLikeTurn(el) && el.querySelector?.('[data-message-author-role="assistant"]')) return expandToTurn(el);
  }
  return null;
}

function lastAssistantMessage() {
  const xs=[...document.querySelectorAll('[data-message-author-role="assistant"]')];
  if(xs.length) return expandToTurn(xs[xs.length-1]);
  const turns=[...document.querySelectorAll('article, [data-testid^="conversation-turn"]')];
  for(let i=turns.length-1;i>=0;i--) {
    const t=turns[i];
    const role=(t.getAttribute('data-message-author-role')||t.getAttribute('data-turn')||'').toLowerCase();
    if(role==='assistant' || t.querySelector?.('[data-message-author-role="assistant"]')) return expandToTurn(t);
  }
  return null;
}

function candidateCopyButton(msg) {
  const buttons=[...msg.querySelectorAll('button')];
  return buttons.find(b => {
    const s=[b.getAttribute('aria-label'),b.getAttribute('title'),b.getAttribute('data-testid'),b.textContent].filter(Boolean).join(' ');
    return /(^|\s)(copy|复制)(\s|$)|copy-turn|copy-message/i.test(s);
  }) || null;
}

async function nativeMarkdownFromMessage(msg) {
  const btn=candidateCopyButton(msg);
  if(!btn) throw new Error('未找到 ChatGPT 自带的复制按钮');
  btn.click();
  await new Promise(r=>setTimeout(r,180));
  const text=await navigator.clipboard.readText();
  if(!text?.trim()) throw new Error('系统剪贴板没有读到 ChatGPT 的原始复制文本');
  return text;
}

function inlineMarkdown(s) {
  const tokens=[];
  s=s.replace(/\\\(([\s\S]*?)\\\)/g,(m,t)=>{ const id=tokens.length; tokens.push(latexToMathML(t,false)); return `\u0000M${id}\u0000`; });
  s=s.replace(/\$([^$\n]+?)\$/g,(m,t)=>{ const id=tokens.length; tokens.push(latexToMathML(t,false)); return `\u0000M${id}\u0000`; });
  let x=esc(s);
  x=x.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/\*([^*]+)\*/g,'<em>$1</em>');
  x=x.replace(/\u0000M(\d+)\u0000/g,(_,i)=>tokens[Number(i)]);
  return x;
}
