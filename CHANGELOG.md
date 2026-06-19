# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Internationalization (i18n)** — UI strings are now wired via react-i18next with English locale shipped in `src/main/resources/javascript/locales/en.json`. Code-level English fallbacks ensure graceful degradation if locales fail to load. Labels include fullscreen button, dialog title, and keyboard hint text.
- **Accessibility (WCAG AAA)** — Enhanced keyboard navigation: Tab focus management with proper trap in fullscreen mode, visible focus indicators on all controls, semantic ARIA labels and descriptions for screen readers, high-contrast syntax colours (≥ 7:1 contrast ratio), and forced-colors media query fallback for Windows High Contrast mode.
- **Unit and component tests** — Full Jest + React Testing Library test suite covering pure highlighter logic (`escapeHtml`, `highlightCsp` function), component rendering, fullscreen toggle, scroll synchronization, keyboard trapping, and accessibility attributes. 80% coverage threshold enforced.
- **Linting infrastructure** — ESLint (with @jahia/eslint-config) and stylelint (with Jahia standard config) integrated into build pipeline with pre-commit hooks via husky.
- **Security hardening** — Syntax highlighter explicitly escapes all dynamic tokens via `escapeHtml()` before HTML injection, covering quotes to remain safe if tokens are ever relocated to attribute positions. Documented `dangerouslySetInnerHTML` invariant in code comments. Removed all console statements from production code.
- **Developer tooling** — Jest configuration with JSDOM environment, Babel setup for JSX/ES6, webpack configuration with source maps in dev mode, and tdd watch mode via `yarn tdd`.

### Changed

- **Editor sizing** — Switched to rem units (instead of px) so the editor respects browser font-size and reflows correctly on zoom.
- **Project structure** — Clarified webpack entry point: `src/javascript/init.js` (main registration) and experimental `src/javascript/index.js` (app-shell bootstrap, internal use). Removed misleading re-export files from tree diagram.
- **Dependencies pruned** — Removed unused transitive dependencies; updated core dependencies (React 18.3.1, @jahia/ui-extender 1.1.0, react-i18next 11.18.6, @jahia/moonstone 2.16.2).

### Fixed

- **Requirements documentation** — Clarified that the `content-security-policy` module is a soft runtime dependency: the fieldset overrides only apply when both modules are enabled on a site. The pom.xml does not hard-depend on it, allowing independent deployment.
- **Syntax highlight token escaping** — All user-provided text is now properly escaped before interpolation into the DOM, preventing potential XSS if policy strings contain special HTML characters.

## [1.0.2] - Unreleased

*Placeholder for future release notes*

## [1.0.1] - Unreleased

*Placeholder for future release notes*

## [1.0.0] - Initial Release

*Initial release of csp-editor module*
