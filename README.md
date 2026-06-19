# CSP Editor

A Jahia module that registers a custom `CspPolicyEditor` selectorType in jContent, providing a purpose-built field for editing [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP) directives.

This module is a companion to the [content-security-policy](https://github.com/Jahia/content-security-policy) module, which enforces CSP headers at runtime. The editor replaces the default textarea on the `policy` property of both `jmix:siteContentSecurityPolicy` and `jmix:pageContentSecurityPolicy` nodes with a richer editing experience.

## Features

- **Syntax highlighting** — directives, quoted keywords (`'self'`, `'nonce-…'`, etc.), scheme-only sources (`https:`, `data:`), full URLs, separators (`;`), and wildcards (`*`) are each highlighted in a distinct colour via a backdrop overlay.
- **Line numbers** — a gutter synced to the textarea scroll shows the current line number.
- **Fullscreen mode** — a toggle button expands the editor to cover the full viewport; pressing `Escape` exits fullscreen.
- **Keyboard accessible** — WCAG AAA compliant focus management, keyboard trapping in fullscreen, and high-contrast colours (≥ 7:1 AAA contrast ratio).
- **Internationalization** — UI strings are i18n-driven with English shipped in locales/en.json and code-level English fallbacks.
- **10-line default height** — in normal mode the editor shows 10 lines and scrolls beyond that; fullscreen fills all available space.

## Requirements

| Dependency | Version | Notes |
|---|---|---|
| Jahia | ≥ 8.2.2.1 | |
| [content-security-policy](https://github.com/Jahia/content-security-policy) module | any | Soft runtime dependency: the CSP fieldset overrides only take effect when both the content-security-policy module (defines the mixins) and csp-editor are enabled on a site. |

## License

MIT — see LICENSE.txt

## Installation

Deploy this module alongside the `content-security-policy` module. Both must be enabled on a site for the custom `CspPolicyEditor` to appear.

## Usage

After both the `content-security-policy` and `csp-editor` modules are enabled on a site:

1. Open the Content Editor and navigate to either a page or the site node.
2. In the Options panel (Advanced section), toggle **Replace Content-Security-Policy at the page/site level**.
3. The `policy` field will appear and render the `CspPolicyEditor` — a syntax-highlighted, keyboard-accessible editor with line numbers and fullscreen toggle.
4. Edit your CSP directives directly. Syntax highlighting updates in real time.
5. Press **Escape** to exit fullscreen mode (if in fullscreen).

The editor is fully keyboard accessible:
- Use Tab to navigate between the fullscreen button and the textarea.
- In fullscreen, Tab wraps around to keep focus trapped inside the overlay.
- All form controls have accessible names and descriptions.

## Building

### Production build (used by `mvn package`)

```bash
yarn install
yarn build:production
```

### Development build (unminified, with source maps)

```bash
mvn package -Pdev
# or directly:
yarn build
```

### Watch mode

```bash
yarn watch
```

### Maven

```bash
mvn clean install
```

The Maven build uses `frontend-maven-plugin` to install Node and Yarn locally (under `./node/`) and run the webpack bundle automatically — no global Node or Yarn installation required.

## Project structure

```
csp-editor/
├── src/
│   ├── javascript/                         # React source (webpack entry point)
│   │   ├── init.js                         # Registers the CspPolicyEditor selectorType
│   │   ├── index.js                        # Experimental app-shell bootstrap (internal use)
│   │   └── CspPolicyEditor/
│   │       ├── CspPolicyEditor.jsx         # React component with syntax highlighting
│   │       └── CspPolicyEditor.scss        # Scoped styles + highlight colours
│   └── main/resources/
│       ├── javascript/apps/                # Webpack output (gitignored)
│       ├── META-INF/
│       │   ├── definitions.cnd
│       │   └── jahia-content-editor-forms/
│       │       └── fieldsets/
│       │           ├── jmix_siteContentSecurityPolicy.json
│       │           └── jmix_pageContentSecurityPolicy.json
│       └── javascript/locales/
│           └── en.json
├── package.json
├── webpack.config.js
├── jest.config.js
├── babel.config.js
└── pom.xml
```

## How it works

### selectorType registration

`src/javascript/init.js` is the webpack entry point. It imports `CspPolicyEditor` from the component module, loads i18n namespaces, and registers the selectorType via the `@jahia/ui-extender` registry:

```js
import {registry} from '@jahia/ui-extender';
import {CspPolicyEditor} from './CspPolicyEditor/CspPolicyEditor';

window.jahia.i18n.loadNamespaces('csp-editor');

export default function () {
    registry.add('selectorType', 'CspPolicyEditor', {
        cmp: CspPolicyEditor,
        supportMultiple: false
    });
}
```

### Form field overrides

Two fieldset configuration files in `META-INF/jahia-content-editor-forms/fieldsets/` tell the Content Editor to use `CspPolicyEditor` instead of the default textarea for the `policy` property on both node types defined by the `content-security-policy` module:

| Fieldset file | Node type | Property |
|---|---|---|
| `jmix_siteContentSecurityPolicy.json` | `jmix:siteContentSecurityPolicy` | `policy` |
| `jmix_pageContentSecurityPolicy.json` | `jmix:pageContentSecurityPolicy` | `policy` |

### Syntax highlighting

The `highlightCsp` function in `CspPolicyEditor.jsx` tokenizes the raw text with a single regex pass (no sequential replacements) and wraps each recognised token in a `<span>` before injecting the result into a backdrop `<div>` positioned behind the transparent textarea. All dynamic tokens are HTML-escaped via `escapeHtml()` before interpolation, preventing XSS.

| Token class | Examples | Colour | Contrast |
|---|---|---|---|
| `csp-directive` | `default-src`, `script-src`, `frame-ancestors` | Blue, bold | ≥ 7:1 (WCAG AAA) |
| `csp-keyword` | `'self'`, `'none'`, `'nonce-…'`, `'sha256-…'` | Green | ≥ 7:1 (WCAG AAA) |
| `csp-sep` | `;` | Red, bold | ≥ 7:1 (WCAG AAA) |
| `csp-scheme` | `https:`, `data:`, `blob:` | Orange | ≥ 7:1 (WCAG AAA) |
| `csp-url` | `https://cdn.example.com` | Purple | ≥ 7:1 (WCAG AAA) |
| `csp-wildcard` | `*` | Red, bold | ≥ 7:1 (WCAG AAA) |

All colours are WCAG AAA compliant and remain accessible in high-contrast and forced-colors modes.

## Testing

### Unit and component tests

```bash
yarn test                # Run Jest with coverage (80% threshold)
yarn tdd                 # Run Jest in watch mode
```

Tests cover:
- Pure syntax highlighter logic (`escapeHtml`, `highlightCsp`)
- Component rendering and user interactions (React Testing Library)
- Fullscreen toggle, scroll sync, keyboard trapping
- Accessibility attributes (aria-label, aria-hidden, etc.)

### Lint

```bash
yarn lint                # Run both SCSS and JS linters
yarn lint:fix            # Auto-fix lint issues
```

- SCSS: stylelint with Jahia's standard config
- JS: ESLint with Jahia's standard config (@jahia/eslint-config)

### E2E tests (Cypress)

Docker-based E2E tests in `tests/` validate:
- CSP policy data contract (API)
- Custom editor renders in Content Editor
- Fullscreen toggle, syntax highlighting, keyboard navigation

See [tests/README.md](tests/README.md) for setup and run instructions.