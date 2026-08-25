'use strict';

// v1.1.0 stable pipeline: preserve ChatGPT's existing Presentation MathML.
// No visible-text/ARIA reconstruction when a real <math> node exists.
(function(){
  const NS='http://www.w3.org/1998/Math/MathML';
  const TRAIL=/^[,.;:!?，。！？；：]+$/;

  function safeIntersects(range,node){ try{return range.intersectsNode(node);}catch(_){return false;} }

  function isDisplayMath(math,anchor){
    if((math.getAttribute('display')||'').toLowerCase()==='block') return true;
    if(anchor?.closest?.('.katex-display')) return true;
    const tag=(anchor?.tagName||'').toLowerCase();
    if(tag==='mjx-container' && (anchor.getAttribute('display')||'').toLowerCase()==='true') return true;
    try {
      const d=getComputedStyle(anchor||math).display||'';
      return d==='block' || d==='flex' || d==='grid';
    } catch(_) { return false; }
  }

  function formulaAnchor(math){
    return math.closest?.('.katex') || math.closest?.('mjx-container') || math.closest?.('[role="math"]') || math;
  }

  function ownedMath(anchor,originalMath){
    if(!anchor) return originalMath;
    if(anchor.matches?.('.katex')) {
      return anchor.querySelector('.katex-mathml math') || anchor.querySelector('math') || originalMath;
    }
    return anchor.querySelector?.('math') || originalMath;
  }

  function expressionRoot(math){
    const sem=[...math.children].find(x=>x.localName==='semantics');
    if(!sem) return math;
    return [...sem.children].find(x=>x.localName!=='annotation' && x.localName!=='annotation-xml') || sem;
  }

  function lastMeaningfulElement(root){
    if(!root) return null;
    const children=[...root.children].filter(x=>x.localName!=='annotation' && x.localName!=='annotation-xml');
    if(!children.length) return root;
    for(let i=children.length-1;i>=0;i--){
      const hit=lastMeaningfulElement(children[i]);
      if(hit && (hit.textContent||'').trim()!=='') return hit;
    }
    return root;
  }

  function stripDisplayTerminalPunctuation(math){
    // User preference: display equations should not end with sentence punctuation.
    let root=expressionRoot(math);
    let guard=8;
    while(root && guard--){
      const leaf=lastMeaningfulElement(root);
      if(!leaf) break;
      const txt=(leaf.textContent||'').trim();
      if(!TRAIL.test(txt)) break;
      leaf.remove();
      root=expressionRoot(math);
    }
    // Presentation MathML is sufficient for Office. Removing annotations avoids
    // consumers preferring stale or differently-tokenized TeX source text.
    math.querySelectorAll('annotation,annotation-xml').forEach(x=>x.remove());
  }

  function cleanMathClone(source,display){
    const math=source.cloneNode(true);
    math.setAttribute('xmlns',NS);
    math.setAttribute('display',display?'block':'inline');
    if(display) stripDisplayTerminalPunctuation(math);
    else math.querySelectorAll('annotation,annotation-xml').forEach(x=>x.remove());
    return math;
  }

  function collect(range,msg){
    let maths=[];
    try { maths=[...msg.querySelectorAll('math')]; } catch(_) {}
    const recs=[];
    const seen=new Set();
    for(const m of maths){
      const a=formulaAnchor(m);
      if(!a || seen.has(a) || !safeIntersects(range,a)) continue;
      const owned=ownedMath(a,m);
      if(!owned) continue;
      const display=isDisplayMath(owned,a);
      recs.push({anchor:a,math:cleanMathClone(owned,display),display});
      seen.add(a);
    }
    recs.sort((x,y)=>{
      if(x.anchor===y.anchor) return 0;
      const p=x.anchor.compareDocumentPosition(y.anchor);
      return p & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });
    return recs;
  }

  function stripAdjacentDisplayPunctuation(wrapper){
    if(!wrapper) return;
    const n=wrapper.nextSibling;
    if(n?.nodeType===Node.TEXT_NODE){
      n.nodeValue=(n.nodeValue||'').replace(/^\s*[,.;:!?，。！？；：]+/,'');
      if(!n.nodeValue) n.remove();
    } else if(n?.nodeType===1 && !n.matches('math')) {
      const t=n.textContent||'';
      if(/^\s*[,.;:!?，。！？；：]+\s*$/.test(t)) n.remove();
    }
  }

  function cloneRangeWithMath(range,msg){
    const recs=collect(range,msg);
    const old=[];
    recs.forEach((r,i)=>{
      old.push([r.anchor,r.anchor.getAttribute('data-cgo-v110-id')]);
      r.anchor.setAttribute('data-cgo-v110-id',String(i));
    });
    let div;
    try {
      const frag=range.cloneContents();
      div=document.createElement('div'); div.appendChild(frag);
    } finally {
      old.forEach(([el,v])=>v===null?el.removeAttribute('data-cgo-v110-id'):el.setAttribute('data-cgo-v110-id',v));
    }
    let written=0;
    for(const holder of [...div.querySelectorAll('[data-cgo-v110-id]')]){
      const id=Number(holder.getAttribute('data-cgo-v110-id'));
      const rec=recs[id];
      if(!rec) continue;
      const math=rec.math.cloneNode(true);
      holder.replaceWith(math);
      if(rec.display) stripAdjacentDisplayPunctuation(math);
      written++;
    }
    div.querySelectorAll('button,svg,[role="button"],#cgo-office-copy-btn,#cgo-office-toast').forEach(x=>x.remove());
    return {div,found:recs.length,written};
  }

  function looksLikeTurn(el){
    if(!el||el.nodeType!==1) return false;
    const role=(el.getAttribute('data-message-author-role')||el.getAttribute('data-turn')||'').toLowerCase();
    const tid=(el.getAttribute('data-testid')||'').toLowerCase();
    return role==='assistant'||tid.startsWith('conversation-turn')||el.tagName==='ARTICLE';
  }

  function findMessage(node){
    let el=node?.nodeType===1?node:node?.parentElement;
    for(let i=0;el&&el!==document.body&&i<18;i++,el=el.parentElement){
      if((el.getAttribute?.('data-message-author-role')||'').toLowerCase()==='assistant') return el.closest('article,[data-testid^="conversation-turn"]')||el;
      if(looksLikeTurn(el)&&el.querySelector?.('[data-message-author-role="assistant"]')) return el;
    }
    const xs=[...document.querySelectorAll('[data-message-author-role="assistant"]')];
    return xs.length?xs[xs.length-1]:null;
  }

  async function writeClipboard(html,plain){
    const item=new ClipboardItem({
      'text/html':new Blob([html],{type:'text/html'}),
      'text/plain':new Blob([plain],{type:'text/plain'})
    });
    await navigator.clipboard.write([item]);
  }

  function toast(text,bad=false){
    document.getElementById('cgo-office-toast')?.remove();
    const d=document.createElement('div'); d.id='cgo-office-toast'; d.textContent=text;
    if(bad)d.style.background='rgba(115,25,25,.96)';
    document.body.appendChild(d); setTimeout(()=>d.remove(),5000);
  }

  async function copyBatch(){
    try{
      const sel=window.getSelection();
      if(!sel||!sel.rangeCount||sel.isCollapsed) throw new Error('请先框选要复制的内容');
      const range=sel.getRangeAt(0).cloneRange();
      const msg=findMessage(range.commonAncestorContainer);
      if(!msg) throw new Error('未定位到 ChatGPT 回答');
      const {div,found,written}=cloneRangeWithMath(range,msg);
      if(!found) throw new Error('选区中没有检测到原生 MathML 公式');
      await writeClipboard(div.innerHTML,sel.toString());
      toast(`已复制：原生 MathML ${found} 个，写入 ${written} 个；行间公式末尾标点已移除`);
    }catch(e){ console.error('[CGO v1.1.0]',e); toast(`复制失败：${e.message}`,true); }
  }

  function install(){
    if(document.getElementById('cgo-office-copy-btn')) return;
    const b=document.createElement('button'); b.id='cgo-office-copy-btn'; b.type='button'; b.textContent='复制整段到 Office';
    b.title='v1.1.0：直接保留 ChatGPT 原生 Presentation MathML；不重建可见公式字符。';
    b.addEventListener('click',copyBatch); document.body.appendChild(b);
  }

  install();
  new MutationObserver(install).observe(document.documentElement,{childList:true,subtree:true});
})();
