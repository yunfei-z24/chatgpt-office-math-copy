# v1.2.1 — Office-safe internal punctuation hotfix

`ChatGPT Office Math Copy` v1.2.1 fixes a PowerPoint/Word import issue where KaTeX's MathML separator commas can be dropped inside expressions such as `P(s=0,t)`.

## Fixed

- Convert internal list/argument punctuation from KaTeX operator form such as `<mo separator="true">,</mo>` to Office-safe math text runs before writing the clipboard payload.
- Preserve internal commas in `P(s=0,t)`, parameter vectors, tuples, intervals, and subscript components such as `T_{in,0}`.
- Keep the existing rule that terminal punctuation on display equations is removed.
- Leave decimals and ordinary math operators unchanged.

## Regression tests

The automated suite now checks both the original v1.2.0 formula pipeline and the v1.2.1 Office punctuation adapter, including:

- `P(s=0,t)` remains exactly ordered and contains an Office-safe comma node;
- parameter-vector internal commas are all retained;
- fraction and superscript MathML structure is unchanged;
- decimal points such as `0.125` are not rewritten;
- KaTeX `separator="true"` comma operators do not survive into the final Office clipboard MathML.

## Installation

Download `chatgpt-office-math-copy-v1.2.1.zip`, extract it, then open `chrome://extensions/`, enable **Developer mode**, choose **Load unpacked**, and select the extracted folder containing `manifest.json`.

Remove or disable v1.2.0 and older versions before testing v1.2.1.
