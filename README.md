# CSP Editor

A Jahia module that registers a custom `CspPolicyEditor` selectorType in jContent, providing a purpose-built field for editing [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP) directives.

This module is a companion to the [content-security-policy](https://github.com/Jahia/content-security-policy) module, which enforces CSP headers at runtime. The editor replaces the default textarea on the `policy` property of both `jmix:siteContentSecurityPolicy` and `jmix:pageContentSecurityPolicy` nodes with a richer editing experience.

## Features

- **Syntax highlighting** — directives, quoted keywords (`'self'`, `'nonce-…'`, etc.), scheme-only sources (`https:`, `data:`), full URLs, separators (`;`), and wildcards (`*`) are each highlighted in a distinct colour via a backdrop overlay.
- **Line numbers** — a gutter synced to the textarea scroll shows the current line number.
- **Fullscreen mode** — a toggle button expands the editor to cover the full viewport; pressing `Escape` exits fullscreen.
- **10-line default height** — in normal mode the editor shows 10 lines and scrolls beyond that; fullscreen fills all available space.

## Requirements

| Dependency | Version |
|---|---|
| Jahia | ≥ 8.2.2.1 |
| [content-security-policy](https://github.com/Jahia/content-security-policy) module | any |

## Installation

Deploy this module alongside the `content-security-policy` module.

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
│   │   ├── index.jsx                       # Registers the CspPolicyEditor selectorType
│   │   └── CspPolicyEditor/
│   │       ├── CspPolicyEditor.jsx         # React component
│   │       ├── CspPolicyEditor.scss        # Scoped styles + highlight colours
│   │       └── index.jsx                   # Re-export
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
└── pom.xml
```

## How it works

### selectorType registration

`src/javascript/index.jsx` registers a `CspPolicyEditor` selectorType via `window.jahia.uiExtender.registry.add` during the `jahiaApp-init` callback:

```js
window.jahia.uiExtender.registry.add('selectorType', 'CspPolicyEditor', {
    cmp: CspPolicyEditor,
    supportMultiple: false
});
```

### Form field overrides

Two fieldset configuration files in `META-INF/jahia-content-editor-forms/fieldsets/` tell the Content Editor to use `CspPolicyEditor` instead of the default textarea for the `policy` property on both node types defined by the `content-security-policy` module:

| Fieldset file | Node type | Property |
|---|---|---|
| `jmix_siteContentSecurityPolicy.json` | `jmix:siteContentSecurityPolicy` | `policy` |
| `jmix_pageContentSecurityPolicy.json` | `jmix:pageContentSecurityPolicy` | `policy` |

### Syntax highlighting

The `highlightCsp` function in `CspPolicyEditor.jsx` tokenizes the raw text with a single regex pass (no sequential replacements) and wraps each recognised token in a `<span>` before injecting the result into a backdrop `<div>` positioned behind the transparent textarea.

| Token class | Examples | Colour |
|---|---|---|
| `csp-directive` | `default-src`, `script-src`, `frame-ancestors` | Blue, bold |
| `csp-keyword` | `'self'`, `'none'`, `'nonce-…'`, `'sha256-…'` | Green |
| `csp-sep` | `;` | Red, bold |
| `csp-scheme` | `https:`, `data:`, `blob:` | Orange |
| `csp-url` | `https://cdn.example.com` | Purple |
| `csp-wildcard` | `*` | Red, bold |