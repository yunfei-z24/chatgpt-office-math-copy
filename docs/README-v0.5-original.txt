ChatGPT → Office 批量公式复制 v0.5

核心修正：
1. 不再依赖 ChatGPT 自带“复制回答”里的 LaTeX/Markdown 数学源。
2. 不再只对 Range.cloneContents() 后的碎片查找公式。
3. 直接在当前真实页面 DOM 中查找所有与鼠标选区相交的公式。
4. 对每个真实公式容器临时加入标记，再克隆选区，并在克隆内容中逐一替换为 Presentation MathML。
5. 支持一次选中正文 + 多个公式 + 多段落，统一复制到 Word/PPT。
6. Toast 同时报告“页面相交公式数 / 实际写入公式数”，便于继续定位。

安装：
chrome://extensions/ → 开发者模式 → 加载已解压的扩展程序 → 选择本文件夹 → 刷新 ChatGPT。

使用：
框选包含多个公式的一整段 → 点击“复制整段到 Office” → 粘贴到 Word/PPT。
