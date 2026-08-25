# v1.2.0 — Current ChatGPT formula-container support

`ChatGPT Office Math Copy` v1.2.0 replaces the experimental 1.0.x/1.1.0 formula reconstruction paths with a tested pipeline for the current ChatGPT math DOM.

## What changed

- Detect current ChatGPT formula containers including `data-math-source`, `data-math`, `.katex`, `.katex-display`, MathJax containers, and native MathML.
- Use a locally bundled, pinned KaTeX 0.16.47 runtime to convert canonical formula source into Presentation MathML.
- Keep all conversion local in the browser: no telemetry, no remote formula service, and no chat-content upload.
- Preserve inline formula punctuation and ordering, including `P(s=0,t)`.
- Preserve fractions, superscripts/subscripts, Greek symbols, `\dot{...}`, `\varnothing`, vectors, matrices, and other KaTeX-supported scientific notation.
- Remove trailing comma/period/semicolon/colon from display equations only. Internal formula punctuation is never stripped.

## Regression-tested cases

The release includes an automated jsdom + KaTeX regression suite covering:

- `P(s=0,t)` internal comma preservation;
- display fractions and powers (`mfrac`, `msup`);
- parameter-vector subscripts and `\dot m_0` (`msub`, `mover`);
- `\varnothing` → `∅`;
- multi-superscript expressions such as `q_i^{MASW} q_i^{SWD} q_i^{FWI}`;
- batch replacement of multiple formulas in one selected section;
- removal of display-equation terminal punctuation.

The GitHub Actions regression run passed before this version was activated in `manifest.json`.

## Installation

Download `chatgpt-office-math-copy-v1.2.0.zip`, extract it, then open `chrome://extensions/`, enable **Developer mode**, choose **Load unpacked**, and select the extracted folder containing `manifest.json`.

Remove or disable older versions before testing v1.2.0.
