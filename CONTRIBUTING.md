# Contributing

Thank you for your interest in contributing to csp-editor!

## Prerequisites

- **Node 22** (or compatible) and **Yarn 1.x** (classic)
  - If running Maven: the build automatically installs Node and Yarn locally via `frontend-maven-plugin`, so no global installation is required.
  - If running Yarn directly: install Node 22 and Yarn 1.x globally, or use nvm/asdf to manage versions.

## Setup

```bash
# Install dependencies
yarn install

# Verify setup
yarn lint
yarn test
```

## Development Workflow

### Watch mode

```bash
yarn watch
```

The webpack dev build will rebuild on every file change. Output is written to `src/main/resources/javascript/apps/`.

### Linting

```bash
yarn lint                # Run both SCSS and JS linters
yarn lint:fix            # Auto-fix lint issues
```

Linting gates both pre-commit (if husky is installed locally) and CI. Fix issues before committing.

### Testing

```bash
yarn test                # Run Jest with coverage (80% threshold enforced)
yarn tdd                 # Run Jest in watch mode for development
```

Tests must pass and maintain 80% coverage. The test suite covers:
- Pure highlighter functions (`escapeHtml`, `highlightCsp`)
- Component rendering and interactions
- Accessibility and keyboard behavior
- Fullscreen toggle and focus management

## Build

### Development build

```bash
mvn package -Pdev
# or directly:
yarn build
```

Output: `src/main/resources/javascript/apps/`

### Production build

```bash
yarn build:production
# or:
mvn clean install
```

Bundles are minified; source maps are omitted in production.

## Code Style

- **Immutability** — Always return new objects, never mutate existing state.
- **Small, focused functions** — Prefer functions under 50 lines; extract utilities.
- **Explicit error handling** — Handle errors at every level; never silently swallow exceptions.
- **Security** — Validate all inputs; escape user content before DOM injection; never hardcode secrets.
- **Accessibility** — All UI should be keyboard navigable and screen-reader friendly. Target WCAG AAA.

## Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>: <description>

<optional body>
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`

Examples:

```
feat: add i18n wiring for UI strings
fix: escape HTML tokens in syntax highlighter
test: add component tests for fullscreen toggle
docs: clarify soft dependency on content-security-policy module
```

## E2E Tests

End-to-end tests are Docker-based Cypress specs in `tests/`. They validate the CSP editor integration with jContent and the Content Editor UI.

**To run E2E tests locally:**

```bash
# 1. Build test container and provision environment
bash tests/ci.build.sh
bash tests/ci.startup.sh

# OR: Run tests against a local node without rebuilding container every time
bash tests/ci.startup.sh notests
source tests/set-env.sh
yarn run e2e:debug
```

See [tests/README.md](tests/README.md) for full details.

## Pre-commit and Pre-push Hooks

If husky is installed locally (via `yarn install`), the following hooks activate automatically:

- **pre-commit:** Runs `yarn lint` with max 1 warning allowed
- **pre-push:** Runs `yarn test`

These can be bypassed if necessary (not recommended), but all checks must pass before a PR is merged.

## Reporting Issues

Please open an issue on GitHub with:
- Clear description of the problem
- Steps to reproduce
- Expected vs. actual behavior
- Browser / Jahia version if relevant

## Pull Requests

1. Fork and create a feature branch from `main`
2. Write tests for new functionality
3. Ensure all tests pass: `yarn test`
4. Ensure linting passes: `yarn lint`
5. Push and open a PR
6. Wait for CI checks to pass
7. Request review

All PRs must:
- Have passing CI checks (linting, tests)
- Maintain 80% coverage
- Include documentation updates if behavior or API changes

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
