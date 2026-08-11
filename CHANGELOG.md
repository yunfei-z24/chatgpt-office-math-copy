# Changelog

All notable changes to this project are documented here.

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
