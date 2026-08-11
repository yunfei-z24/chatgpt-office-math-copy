<div align="center">
  <img src="assets/logo.svg" width="128" alt="ChatGPT Office Math Copy 项目 Logo" />

# ChatGPT Office Math Copy

**一次框选 ChatGPT 中的正文和多个公式，并批量复制到 Microsoft Word / PowerPoint。**

[English](README.md) · [MIT License](LICENSE) · [隐私说明](PRIVACY.md)
</div>

## 项目目标

ChatGPT 网页端可以显示高质量二维数学公式，但普通复制到 Word / PowerPoint 时，网页中的数学结构有时会被压平为普通文本，导致分式、上下标、偏导、积分等格式丢失。

本扩展重点解决的不是“一个公式复制一次”，而是：

**框选整段内容 → 同时识别正文与多个公式 → 一次复制 → 直接粘贴到 Word / PowerPoint。**

<div align="center">
  <img src="assets/demo.gif" width="900" alt="批量公式复制演示" />
</div>

## 主要功能

- 一次复制正文 + 多个公式 + 多段落；
- 尽可能将公式重建为 Presentation MathML，而不是图片；
- 在真实页面选区中判断公式是否与选区相交；
- 支持 MathML、KaTeX、MathJax、TeX annotation、`data-latex`、`aria-label` 等来源；
- 支持常见科研公式结构，包括分式、上下标、根式、积分、求和、希腊字母、矩阵及常见对齐环境；
- 本地处理，不上传聊天内容，不含遥测；
- 右下角 Toast 显示“选区相交公式数 / 实际写入公式数”，便于定位兼容问题。

## 安装

### 推荐：GitHub Release 安装包

1. 从最新 Release 下载 `chatgpt-office-math-copy-v1.0.0.zip`；
2. 解压到固定目录；
3. Chrome 打开 `chrome://extensions/`；
4. 开启“开发者模式”；
5. 点击“加载已解压的扩展程序”；
6. 选择解压后的扩展文件夹；
7. 刷新 ChatGPT。

## 使用

1. 在 ChatGPT 页面框选一整段内容；
2. 选区中可以同时包含多条公式；
3. 点击右下角 **“复制整段到 Office”**；
4. 到 Word / PowerPoint 直接粘贴。

如果提示：

> 页面相交 3 个公式，实际写入 3 个公式

说明检测与转换均成功。

## 隐私

当前代码不包含远程 API、遥测、分析 SDK、第三方转换服务器或聊天内容上传逻辑，处理过程在浏览器本地完成。详见 [PRIVACY.md](PRIVACY.md)。

## License

本项目采用 **MIT License**，允许个人、科研和商业使用、修改与再发布，但需保留版权和许可证声明。详见 [LICENSE](LICENSE)。

## 非官方声明

本项目与 OpenAI、ChatGPT、Microsoft、Word、PowerPoint 均无官方隶属、授权或背书关系，相关商标归各自权利人所有。
