# ChatGPT Office Math Copy

将 ChatGPT 网页中的**正文 + 多个数学公式**一次性复制到 Microsoft Word / PowerPoint，并尽可能保留为 Office 可继续编辑的数学结构。

> 当前版本：`v0.5.0`

## 为什么做这个项目

过去，ChatGPT 网页中的二维公式可以较稳定地直接复制到 Word / PowerPoint，并保持接近网页端的二维排版。随着 ChatGPT 前端数学渲染与复制链路变化，普通复制有时只保留文本层，导致分式、上下标、偏导等结构丢失。

本扩展尝试修复这条链路：

**ChatGPT 页面选区 → 检测选区内全部公式 → 提取 MathML / 数学源 → 重建富文本剪贴板 → Word / PowerPoint**

与“点击一个公式、复制一次”的扩展不同，本项目的目标是：

- 一次框选整段内容；
- 同时包含正文、多个公式、编号、段落；
- 一次复制到 Office；
- 尽可能保留公式为可编辑数学结构，而不是图片。

## 当前功能

- 批量复制选区中的正文与多个公式；
- 未框选时，可复制最近一条 ChatGPT 回答；
- 在真实页面 DOM 中检测与选区相交的公式；
- 支持 MathML、KaTeX、MathJax 及部分自定义数学节点；
- 尝试从 MathML、`annotation`、`data-latex`、`aria-label` 等来源恢复数学表达式；
- 将常见 LaTeX 数学结构转换为 Presentation MathML；
- 支持分式、上下标、根式、积分、求和、希腊字母、常见矩阵/对齐环境等；
- Toast 显示“页面相交公式数 / 实际写入公式数”，便于诊断兼容性。

## 安装

目前项目以 Chrome / Chromium Manifest V3 扩展形式发布。

1. 下载或克隆本仓库；
2. Chrome 打开 `chrome://extensions/`；
3. 开启“开发者模式”；
4. 点击“加载已解压的扩展程序”；
5. 选择本仓库根目录；
6. 刷新 ChatGPT 页面。

## 使用

1. 在 ChatGPT 网页中框选一整段内容；
2. 选区可以同时包含正文、多个二维公式和多个段落；
3. 点击右下角 **“复制整段到 Office”**；
4. 到 Word 或 PowerPoint 中直接粘贴。

如果没有框选内容，按钮会尝试复制最近一条 ChatGPT 回答。

## 诊断提示

扩展会显示类似：

> 已批量复制选区：页面相交 3 个公式，实际写入 3 个公式（实时 DOM → MathML）

含义：

- `页面相交 3 / 实际写入 3`：公式识别与替换均成功；
- `页面相交 3 / 实际写入 1`：已找到公式，但复制重建时仍有节点未成功写入；
- `页面相交 1`：部分公式采用了尚未支持的 DOM / 数学组件；
- `页面相交 0`：当前 ChatGPT 数学结构未被识别，需要进一步适配。

## 权限说明

`manifest.json` 当前使用：

- `clipboardRead`
- `clipboardWrite`
- `https://chatgpt.com/*`
- `https://chat.openai.com/*`

扩展代码当前**不包含任何网络请求、遥测、分析 SDK、远程代码下载或用户数据上传逻辑**。处理过程在浏览器本地完成。

详见 [PRIVACY.md](PRIVACY.md)。

## 已知限制

1. ChatGPT 是持续更新的 Web 应用，DOM 与数学渲染组件变化可能导致兼容性失效；
2. 当前内置 LaTeX → MathML 转换器只覆盖常见科研公式子集，不是完整 TeX 引擎；
3. Word 与 PowerPoint 对剪贴板 MathML / HTML 的解析行为可能因 Office 版本而异；
4. 特殊宏、自定义命令、复杂多行环境可能需要额外适配；
5. 本项目目前仍处于实验性阶段，建议在重要文档中粘贴后检查公式结构。

## 项目结构

```text
.
├── manifest.json
├── content.js
├── style.css
├── README.md
├── CHANGELOG.md
├── PRIVACY.md
├── CONTRIBUTING.md
├── SECURITY.md
└── .github/
    └── ISSUE_TEMPLATE/
```

## 开发

本项目当前无构建步骤。

修改源码后：

1. 打开 `chrome://extensions/`；
2. 找到本扩展；
3. 点击“重新加载”；
4. 刷新 ChatGPT 页面。

建议提交 Bug 时附带：

- Chrome / Edge 版本；
- Word / PowerPoint 版本；
- ChatGPT 页面截图；
- Toast 中“页面相交 / 实际写入”两个数字；
- 可复现公式示例。

## Roadmap

- [ ] 提升新版 ChatGPT 自定义公式节点兼容性；
- [ ] 更稳健的跨节点选区重建；
- [ ] 扩展 LaTeX → MathML 语法覆盖；
- [ ] 针对 Word / PowerPoint 分别优化剪贴板格式；
- [ ] 增加自动化 DOM fixture 测试；
- [ ] 增加可选调试面板；
- [ ] Edge / Chrome 兼容性测试矩阵。

## 非官方声明

本项目是独立的开源浏览器扩展，与 OpenAI、ChatGPT、Microsoft 无官方隶属、授权或背书关系。相关商标归各自权利人所有。

## License

公开发布前请由仓库所有者选择许可证。对于希望允许自由使用、修改和再发布的轻量浏览器扩展，通常可考虑 **MIT License**；如果希望衍生版本继续开源，可考虑 GPL-3.0。

当前仓库包暂未主动替你选择许可证。
