'use strict';

async function copyBatch() {
  try {
    const sel=window.getSelection();
    const hasSelection=!!(sel && sel.rangeCount && !sel.isCollapsed);
    const range=hasSelection ? sel.getRangeAt(0).cloneRange() : null;
    let msg=findMessageFromNode(range?.commonAncestorContainer) || lastAssistantMessage();
    if(!msg) throw new Error('没有定位到 ChatGPT 回答');

    if(hasSelection) {
      const {div,intersected,written}=cloneSelectionWithLiveMath(range,msg);
      if(intersected>0) {
        await writeClipboard(div.innerHTML, div.innerText || div.textContent || sel.toString());
        toast(`已批量复制选区：页面相交 ${intersected} 个公式，实际写入 ${written} 个公式（实时 DOM → MathML）`);
        return;
      }
    } else {
      const {div,intersected,written}=cloneWholeMessageWithLiveMath(msg);
      if(intersected>0) {
        await writeClipboard(div.innerHTML, div.innerText || div.textContent || '');
        toast(`已复制整条回答：页面识别 ${intersected} 个公式，实际写入 ${written} 个公式（实时 DOM → MathML）`);
        return;
      }
    }

    if(hasSelection) {
      const sf=selectionFragment();
      if(sf) {
        await writeClipboard(sf.div.innerHTML, sf.div.innerText || sf.div.textContent || sel.toString());
        toast('未提取到结构化数学源；已按原始富文本复制选区。', true);
        return;
      }
    }
    throw new Error('当前页面选区中没有提取到可转换的数学结构');
  } catch(e) {
    console.error('[ChatGPT Office Copy]',e);
    toast(`复制失败：${e.message}\n请刷新 ChatGPT 后重试。`, true);
  }
}

function installButton(){
  if(document.getElementById('cgo-office-copy-btn')) return;
  const b=document.createElement('button'); b.id='cgo-office-copy-btn'; b.type='button'; b.textContent='复制整段到 Office';
  b.title='若已框选内容则复制选区；否则复制最近一条 ChatGPT 回答。v0.5 直接从真实页面范围批量识别全部公式。';
  b.addEventListener('click', copyBatch); document.body.appendChild(b);
}

installButton();
new MutationObserver(installButton).observe(document.documentElement,{childList:true,subtree:true});
