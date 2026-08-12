'use strict';

// Compatibility patches for TeX emitted by the current ChatGPT copy pipeline.
// Keep these here so the small extension can stay dependency-free while still
// handling the constructs that commonly appear in ChatGPT answers.
(function installTexCompatibilityPatches(){
  if(typeof TexParser==='undefined' || TexParser.prototype.__cgoOfficePatched) return;

  const originalCommand=TexParser.prototype.command;
  TexParser.prototype.command=function(name){
    if(name==='xrightarrow' || name==='xleftarrow') {
      const over=this.group();
      return `<mover>${mo(name==='xrightarrow'?'→':'←')}${row(over)}</mover>`;
    }
    if(name==='overset') {
      const over=this.group(), base=this.group();
      return `<mover>${row(base)}${row(over)}</mover>`;
    }
    if(name==='underset') {
      const under=this.group(), base=this.group();
      return `<munder>${row(base)}${row(under)}</munder>`;
    }
    if(name==='cdots' || name==='dots') return mo('⋯');
    if(name==='ldots') return mo('…');
    return originalCommand.call(this,name);
  };
  TexParser.prototype.__cgoOfficePatched=true;

  const originalLatexToMathML=latexToMathML;
  latexToMathML=function(tex,display=true){
    tex=String(tex??'')
      .replace(/\\_/g,'_')
      .replace(/\\%/g,'%')
      .replace(/\\#/g,'#');
    return originalLatexToMathML(tex,display);
  };
})();

async function copyViaNativeMarkdown(msg, hasSelection, selectionText){
  const md=await nativeMarkdownFromMessage(msg);
  const target=hasSelection ? selectedMarkdownSlice(md,selectionText) : md;
  if(!target?.trim()) throw new Error('未能从 ChatGPT 原始复制文本定位当前选区');

  const converted=markdownToOfficeHtml(target);
  if(converted.formulas<=0) throw new Error('ChatGPT 原始复制文本中未识别到公式');

  const plain=hasSelection
    ? (selectionText || target)
    : (msg.innerText || msg.textContent || target);
  await writeClipboard(converted.html,plain);
  return converted.formulas;
}

async function copyBatch() {
  try {
    const sel=window.getSelection();
    const hasSelection=!!(sel && sel.rangeCount && !sel.isCollapsed);
    const selectionText=hasSelection ? sel.toString() : '';
    const range=hasSelection ? sel.getRangeAt(0).cloneRange() : null;
    const msg=findMessageFromNode(range?.commonAncestorContainer) || lastAssistantMessage();
    if(!msg) throw new Error('没有定位到 ChatGPT 回答');

    // Primary route: use ChatGPT's own Copy output. It contains the original
    // Markdown/LaTeX, so formulas are not lost when the visible DOM contains
    // accessibility mirrors, split renderer nodes, or hidden source text.
    try {
      const formulas=await copyViaNativeMarkdown(msg,hasSelection,selectionText);
      toast(`${hasSelection?'已批量复制选区':'已复制整条回答'}：识别 ${formulas} 个公式（ChatGPT 原始 LaTeX → MathML）`);
      return;
    } catch(nativeErr) {
      console.warn('[ChatGPT Office Copy] Native Markdown route failed; falling back to live DOM.',nativeErr);
    }

    // Fallback route: recover Presentation MathML directly from the live page.
    if(hasSelection) {
      const {div,intersected,written}=cloneSelectionWithLiveMath(range,msg);
      if(intersected>0 && written>0) {
        await writeClipboard(div.innerHTML,div.innerText || div.textContent || selectionText);
        toast(`已批量复制选区：页面相交 ${intersected} 个公式，实际写入 ${written} 个公式（实时 DOM → MathML）`);
        return;
      }
    } else {
      const {div,intersected,written}=cloneWholeMessageWithLiveMath(msg);
      if(intersected>0 && written>0) {
        await writeClipboard(div.innerHTML,div.innerText || div.textContent || '');
        toast(`已复制整条回答：页面识别 ${intersected} 个公式，实际写入 ${written} 个公式（实时 DOM → MathML）`);
        return;
      }
    }

    if(hasSelection) {
      const sf=selectionFragment();
      if(sf) {
        await writeClipboard(sf.div.innerHTML,sf.div.innerText || sf.div.textContent || selectionText);
        toast('未提取到结构化数学源；已按原始富文本复制选区。',true);
        return;
      }
    }
    throw new Error('当前页面选区中没有提取到可转换的数学结构');
  } catch(e) {
    console.error('[ChatGPT Office Copy]',e);
    toast(`复制失败：${e.message}\n请刷新 ChatGPT 后重试。`,true);
  }
}

function installButton(){
  if(document.getElementById('cgo-office-copy-btn')) return;
  const b=document.createElement('button');
  b.id='cgo-office-copy-btn';
  b.type='button';
  b.textContent='复制整段到 Office';
  b.title='若已框选内容则复制选区；否则复制最近一条 ChatGPT 回答。优先使用 ChatGPT 原始 Markdown/LaTeX 转换为 Office 可导入的 MathML。';
  b.addEventListener('click',copyBatch);
  document.body.appendChild(b);
}

installButton();
new MutationObserver(installButton).observe(document.documentElement,{childList:true,subtree:true});
