'use strict';

function markdownToOfficeHtml(md) {
  const blocks=[]; let formulas=0;
  md=md.replace(/\r\n/g,'\n');
  md=md.replace(/\\\[([\s\S]*?)\\\]/g,(m,t)=>{ const id=blocks.length; blocks.push(latexToMathML(t,true)); formulas++; return `\n@@MATH${id}@@\n`; });
  md=md.replace(/\$\$([\s\S]*?)\$\$/g,(m,t)=>{ const id=blocks.length; blocks.push(latexToMathML(t,true)); formulas++; return `\n@@MATH${id}@@\n`; });
  const parts=md.split(/\n{2,}/).map(p=>p.trim()).filter(Boolean);
  let html='<div>';
  for(let p of parts){
    const mm=p.match(/^@@MATH(\d+)@@$/); if(mm){ html+=blocks[Number(mm[1])]; continue; }
    const h=p.match(/^(#{1,6})\s+(.+)$/s); if(h){ const lvl=h[1].length; html+=`<h${lvl}>${inlineMarkdown(h[2])}</h${lvl}>`; continue; }
    if(/^[-*+]\s+/m.test(p)) {
      const lis=p.split('\n').map(x=>x.replace(/^[-*+]\s+/, '')).map(x=>`<li>${inlineMarkdown(x)}</li>`).join(''); html+=`<ul>${lis}</ul>`; continue;
    }
    html+=`<p>${inlineMarkdown(p).replace(/\n/g,'<br>')}</p>`;
  }
  html+='</div>';
  const inlineCount=(md.match(/\\\([^)]*\\\)|\$[^$\n]+\$/g)||[]).length;
  formulas += inlineCount;
  return {html, formulas};
}

async function writeClipboard(html, plain) {
  const item=new ClipboardItem({
    'text/html': new Blob([html],{type:'text/html'}),
    'text/plain': new Blob([plain],{type:'text/plain'})
  });
  await navigator.clipboard.write([item]);
}

function toast(msg, bad=false) {
  document.getElementById('cgo-office-toast')?.remove();
  const d=document.createElement('div'); d.id='cgo-office-toast'; d.textContent=msg;
  if(bad) d.style.background='rgba(115,25,25,.96)'; document.body.appendChild(d);
  setTimeout(()=>d.remove(),5200);
}

function cleanAnchorLine(s='') { return s.replace(/\s+/g,' ').trim(); }

function isGoodTextAnchor(line) {
  line=cleanAnchorLine(line);
  if(line.length < 8) return false;
  const letters=(line.match(/[\p{L}\p{N}\u3400-\u9fff]/gu)||[]).length;
  const mathish=(line.match(/[=+−×÷∂∇∫√^_{}\\]/g)||[]).length;
  return letters >= 6 && mathish < Math.max(4, letters*0.35);
}

function selectionTextAnchors(text) {
  const lines=text.split(/\n+/).map(cleanAnchorLine).filter(isGoodTextAnchor);
  if(!lines.length) return {first:'', last:''};
  return {first:lines[0], last:lines[lines.length-1]};
}

function findAnchor(md, line, from=0, reverse=false) {
  line=cleanAnchorLine(line);
  if(!line) return -1;
  const lens=[96,80,64,52,42,32,24,18,14,10].filter(n=>n<=line.length);
  const starts=[0];
  if(line.length>30) starts.push(Math.max(0,Math.floor((line.length-30)/2)), Math.max(0,line.length-30));
  for(const n of lens){
    for(const st of starts){
      const piece=line.slice(st, Math.min(line.length, st+n)).trim();
      if(piece.length<8) continue;
      const pos=reverse ? md.lastIndexOf(piece) : md.indexOf(piece,from);
      if(pos>=0) return pos;
    }
  }
  const chunks=line.match(/[\u3400-\u9fff]{2,}|[A-Za-z0-9]{3,}/g) || [];
  if(chunks.length>=2){
    const chosen=chunks.slice(0,Math.min(5,chunks.length));
    const pat=chosen.map(x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('[\\s\\S]{0,32}?');
    try {
      const re=new RegExp(pat,'g'); let m, hit=-1;
      while((m=re.exec(md))) { if(m.index>=from) { hit=m.index; if(!reverse) break; } if(re.lastIndex===m.index) re.lastIndex++; }
      if(hit>=0) return hit;
    } catch(_) {}
  }
  return -1;
}

function selectedMarkdownSlice(md, selectionText) {
  const {first,last}=selectionTextAnchors(selectionText);
  if(!first && !last) return null;
  let a=first ? findAnchor(md,first,0,false) : -1;
  let b=last ? findAnchor(md,last,Math.max(0,a),true) : -1;
  if(a<0 && b<0) return null;
  if(a<0) a=0;
  if(b<0 || b<a) b=md.length;
  else {
    const nl=md.indexOf('\n',b);
    b=nl>=0?nl:md.length;
  }
  const pa=md.lastIndexOf('\n\n',a);
  if(pa>=0) a=pa+2;
  const pb=md.indexOf('\n\n',b);
  if(pb>=0) b=pb;
  const slice=md.slice(a,b).trim();
  return slice || null;
}

function safeIntersects(range, node) {
  try { return range.intersectsNode(node); } catch (_) { return false; }
}

function nodeOrder(a,b) {
  if(a===b) return 0;
  const p=a.compareDocumentPosition(b);
  if(p & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
  if(p & Node.DOCUMENT_POSITION_PRECEDING) return 1;
  return 0;
}

function texLike(s='') {
  return /\\(?:frac|dfrac|tfrac|partial|nabla|alpha|beta|gamma|delta|epsilon|varepsilon|lambda|mu|sigma|tau|phi|psi|omega|sum|int|sqrt|mathrm|mathbf|mathcal|begin)|[_^] *\{|\\\[|\\\(/.test(s);
}

function mathMLFromElement(el) {
  if(!el || el.nodeType!==1) return null;
  const tag=el.tagName?.toLowerCase();
  if(tag==='math') {
    const c=el.cloneNode(true); c.setAttribute('xmlns',NS); return c.outerHTML;
  }
  let m=null;
  try { m=el.querySelector?.('math'); } catch(_) {}
  if(m) { const c=m.cloneNode(true); c.setAttribute('xmlns',NS); return c.outerHTML; }

  const tex=extractTexFromNode(el);
  if(tex && texLike(tex)) {
    let disp=true;
    try { disp=getComputedStyle(el).display!=='inline'; } catch(_) {}
    return latexToMathML(tex,disp);
  }

  try {
    if(el.shadowRoot) {
      const sm=el.shadowRoot.querySelector('math');
      if(sm) { const c=sm.cloneNode(true); c.setAttribute('xmlns',NS); return c.outerHTML; }
      const ann=el.shadowRoot.querySelector('annotation[encoding="application/x-tex"], annotation[encoding*="tex" i]');
      if(ann?.textContent?.trim()) return latexToMathML(ann.textContent.trim(),true);
    }
  } catch(_) {}
  return null;
}

function isMathishElement(el) {
  if(!el || el.nodeType!==1) return false;
  const tag=(el.tagName||'').toLowerCase();
  if(['math','mjx-container'].includes(tag)) return true;
  const role=(el.getAttribute('role')||'').toLowerCase();
  if(role==='math') return true;
  const cls=(typeof el.className==='string'?el.className:'').toLowerCase();
  const testid=(el.getAttribute('data-testid')||'').toLowerCase();
  if(/katex|mathjax|mjx|equation|formula|latex|math/.test(cls+' '+testid)) return true;
  for(const k of ['data-latex','data-tex','data-math','data-expression']) if(el.hasAttribute?.(k)) return true;
  try { if(el.querySelector('math, mfrac, msub, msup, msubsup, annotation[encoding*="tex" i]')) return true; } catch(_) {}
  return false;
}

function formulaAnchor(el, msg) {
  if(!el) return el;
  let cur=el;
  for(let depth=0; cur && cur!==msg && depth<6; depth++,cur=cur.parentElement) {
    const tag=(cur.tagName||'').toLowerCase();
    const cls=(typeof cur.className==='string'?cur.className:'').toLowerCase();
    const role=(cur.getAttribute?.('role')||'').toLowerCase();
    if(tag==='mjx-container' || role==='math' || /(^|\s)katex(\s|$)|katex-display|mathjax|equation|formula/.test(cls)) return cur;
  }
  return el;
}

function collectLiveFormulaRecords(range, msg) {
  const raw=[];
  const selectors=[
    'math','mjx-container','.katex','.katex-display','[role="math"]',
    '[data-latex]','[data-tex]','[data-math]','[data-expression]',
    '[class*="math" i]','[class*="equation" i]','[class*="formula" i]','[class*="latex" i]'
  ].join(',');
  let nodes=[];
  try { nodes=[...msg.querySelectorAll(selectors)]; } catch(_) {}

  if(nodes.length<3) {
    let all=[]; try { all=[...msg.querySelectorAll('*')]; } catch(_) {}
    for(const el of all) if(isMathishElement(el)) nodes.push(el);
  }

  const seenNode=new Set();
  for(const el0 of nodes) {
    if(!el0 || seenNode.has(el0) || !safeIntersects(range,el0)) continue;
    seenNode.add(el0);
    const markup=mathMLFromElement(el0);
    if(!markup) continue;
    const anchor=formulaAnchor(el0,msg);
    if(!anchor || !safeIntersects(range,anchor)) continue;
    raw.push({el:el0,anchor,markup});
  }

  raw.sort((a,b)=>nodeOrder(a.anchor,b.anchor));
  const out=[];
  for(const rec of raw) {
    const duplicate=out.some(x => x.anchor===rec.anchor ||
      (x.anchor.contains?.(rec.anchor) || rec.anchor.contains?.(x.anchor)) &&
      x.markup.replace(/\s+/g,'')===rec.markup.replace(/\s+/g,''));
    if(!duplicate) out.push(rec);
  }
  return out;
}

function cloneSelectionWithLiveMath(range, msg) {
  const records=collectLiveFormulaRecords(range,msg);
  const tagged=[];
  const previous=[];
  records.forEach((r,i)=>{
    const el=r.anchor;
    if(!el?.setAttribute) return;
    const old=el.getAttribute('data-cgo-formula-id');
    previous.push([el,old]);
    el.setAttribute('data-cgo-formula-id',String(i));
    tagged.push(r);
  });

  let div;
  try {
    const frag=range.cloneContents();
    div=document.createElement('div'); div.appendChild(frag);
  } finally {
    previous.forEach(([el,old])=>{ if(old===null) el.removeAttribute('data-cgo-formula-id'); else el.setAttribute('data-cgo-formula-id',old); });
  }

  let written=0;
  const replacedIds=new Set();
  for(const el of [...div.querySelectorAll('[data-cgo-formula-id]')]) {
    const id=Number(el.getAttribute('data-cgo-formula-id'));
    const rec=tagged[id];
    if(!rec || replacedIds.has(id)) continue;
    const holder=document.createElement('span'); holder.innerHTML=rec.markup;
    const repl=holder.firstElementChild;
    if(repl) { el.replaceWith(repl); replacedIds.add(id); written++; }
  }

  for(const el of [...div.querySelectorAll('[aria-hidden="true"] .katex-html, .katex-html[aria-hidden="true"]')]) {
    try { el.remove(); } catch(_) {}
  }
  return {div, intersected:records.length, written};
}

function cloneWholeMessageWithLiveMath(msg) {
  const r=document.createRange(); r.selectNodeContents(msg);
  const {div,intersected,written}=cloneSelectionWithLiveMath(r,msg);
  div.querySelectorAll('button,svg,[role="button"],#cgo-office-copy-btn,#cgo-office-toast').forEach(x=>x.remove());
  return {div,intersected,written};
}
