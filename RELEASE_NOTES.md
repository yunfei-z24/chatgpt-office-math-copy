# v1.0.0 — Initial stable open-source release

`ChatGPT Office Math Copy` v1.0.0 is the first stable public release of the batch-copy workflow developed to move ChatGPT technical content into Microsoft Word and PowerPoint without copying equations one at a time.

## Highlights

- Batch-copy a selection containing prose and multiple formulas.
- Detect math nodes against the live browser selection.
- Reconstruct supported equations as Presentation MathML for Office.
- Support MathML, KaTeX, MathJax and several fallback math-source paths.
- Local-only processing: no telemetry and no chat-content upload.
- Diagnostic toast reporting formulas intersected and formulas written.
- English and Chinese documentation.
- MIT licensed.

## Installation

Download `chatgpt-office-math-copy-v1.0.0.zip`, extract it, then load the extracted folder from `chrome://extensions/` with Developer mode enabled.

## Important compatibility note

ChatGPT is a continuously updated web application. Changes to its DOM or math-rendering components may require future adapters. If a formula is not detected, please open a bug report and include the diagnostic toast values and a screenshot.
