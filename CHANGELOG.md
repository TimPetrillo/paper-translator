# Changelog

All notable changes to this project will be documented in this file. The format is based on Keep a Changelog, and the project follows Semantic Versioning.

## [Unreleased]

## [0.2.0] - 2026-06-23

### Fixed

- Group bilingual translations by paragraph instead of inserting fragmented Chinese after every inline text node on arXiv HTML pages.
- Skip arXiv author cards and recognize names containing middle initials such as `Adam K. Leroy`.
- Select arXiv's full page content container instead of an author-only `article.ltx_document` block.
- Narrow generic author selectors so `ltx_authors_multiline` no longer causes the entire arXiv article to be skipped.
- Protect inline equations and citations with placeholders, then restore cloned source DOM in bilingual translations.
- Omit arXiv's duplicated `.ltx_note_mark` dagger symbols from translated facilities/software notes.
- Prevent inherited justified alignment from stretching spaces around citations and long URLs.

### Added

- Selectable Anthropic Messages, OpenAI Chat Completions, OpenAI Responses, and Gemini Native generateContent protocols.
- Initial Manifest V3 Chrome/Edge extension structure.
- User-configured OpenAI Compatible Chat Completions API.
- Quick, academic, and refined translation modes.
- Bilingual and in-place replacement rendering.
- Academic DOM extraction and protected-content filters.
- Concurrent chunk queue, cancellation, timeout, retry, 429 backoff, and token-limit splitting.
- Popup, Options page, privacy documentation, CI, issue templates, and release packaging.

### Changed

- Move API and translation parameter editing to the full Options page while keeping the Popup as a compact translation controller.

## [0.1.0] - 2026-06-23

- Initial open-source project baseline.
