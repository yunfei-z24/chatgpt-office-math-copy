# Changelog

All notable changes to this project are documented here.

## [1.0.5] - 2026-08-24

### Fixed
- Prevent punctuation-only renderer spans such as commas, brackets, colons, and equals signs from becoming separate Office Math objects.
- Merge token-level inline math fragments back into one MathML object for a complete inline expression, fixing misplaced commas and reordered symbols after PowerPoint paste.
- Improve preservation of expressions such as `P(s=0,t)` and parameter vectors such as `\mu_{acc}=[P_0,\dot m_0,T_{in,0},...]`.
- Use combining MathML accent marks for `\dot`, `\ddot`, and related accents to improve Office placement of over-dots.
- Remove nested duplicate inline math records when a larger complete formula container has already been recovered.

## [1.0.4] - 2026-08-24

### Fixed
- Recover inline math and inline variables from the visible ChatGPT renderer when no TeX/MathML source is exposed on the node.
- Preserve short inline expressions such as `s = 0`, `s = 1`, `P(s = 0,t)`, and similar scientific variables instead of dropping them during Office paste.
- Added `\dot{...}` and `\ddot{...}` support using MathML accent structures, fixing time-derivative notation such as `\dot m_0`.
- Added fallback support for common visible Unicode math glyphs, subscripts, superscripts, Greek symbols, set symbols, and relation operators when reconstructing inline MathML.
- Prefer compact outer inline math wrappers to avoid duplicating nested renderer glyph spans.

### Changed
- Added `content-inline-fixes.js` after `content-fixes.js` and before `content-main.js`.

## [1.0.3] - 2026-08-12

### Fixed
- Detect simple inline TeX expressions such as `q_i`, `x_i`, `P_m`, and `U^2` instead of dropping them from the Office clipboard output.
- Always scan relevant inline math candidates within the selected range, rather than stopping after three obvious math nodes.
- Map `\varnothing` and `\emptyset` to the true empty-set symbol `∅`.
- Handle `\boxed{...}` without emitting the literal word `boxed` into Word or PowerPoint.
- Added compatibility for `\xrightarrow`, `\xleftarrow`, `\overset`, `\underset`, `\cdots`, and `\ldots`.

### Changed
- Added `content-fixes.js` as a compatibility layer loaded after DOM extraction and before the main copy controller.

## [1.0.2] - 2026-08-12

### Fixed
- Corrected the copy-button CSS selector so the button is visibly fixed above the ChatGPT composer.
- Restored toast positioning and visibility.

## [1.0.1] - 2026-08-12

### Changed
- Prefer ChatGPT's native copied Markdown/LaTeX as the primary source when available, with live-DOM MathML recovery as fallback.
- Improved handling of annotated arrows and common TeX constructs.

## [1.0.0] - 2026-08-11

### Added
- First stable public open-source release.
- English primary README and Chinese README.
- Project logo and demo GIF.
- MIT License and formal release notes.
- GitHub Release packaging workflow.

### Changed
- Promoted the extension version from 0.5.0 to 1.0.0.
- Standardized the extension name as `ChatGPT Office Math Copy`.
- Split runtime scripts into core, DOM and main modules for maintainability.

### Core capabilities
- Batch copying of prose and multiple equations.
- Live selection-to-math-node intersection detection.
- MathML / KaTeX / MathJax / TeX-source fallback extraction.
- Presentation MathML reconstruction for supported scientific formulas.
- Local-only processing with no telemetry or remote conversion service.

## [0.5.0] - 2026-08-11

### Changed
- Removed dependence on ChatGPT's built-in answer-copy Markdown/LaTeX source.
- Switched to detecting formula nodes intersecting the real page selection.
- Added selector-independent fallback scanning for math nodes.
- Added open shadow-root MathML / TeX annotation detection.
- Reported both intersected and written formula counts in the diagnostic toast.
