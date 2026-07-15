/**
 * F11(a) — pom.xml no-hard-dependency contract test (SUPPORT-646 gap list
 * Tier 4, item 10).
 *
 * csp-editor has a documented SOFT/runtime-only relationship with the
 * companion `content-security-policy` module (it only overrides that module's
 * `policy` field's selectorType once both modules are enabled on a site) — it
 * must never gain a hard Maven/OSGi dependency on it. This locks that fact as
 * a regression tripwire: if someone later adds
 * `<artifactId>content-security-policy</artifactId>` to pom.xml's
 * dependencies, this test fails, forcing a conscious decision (update the
 * README's "no hard dependency" claim, or revert the pom.xml change).
 */

const fs = require('fs');
const path = require('path');

const pomPath = path.join(__dirname, '..', '..', 'pom.xml');
const pomSource = fs.readFileSync(pomPath, 'utf8');

describe('pom.xml — no hard dependency on content-security-policy (F11a)', () => {
    test('pom.xml has no <artifactId>content-security-policy</artifactId> entry', () => {
        expect(pomSource).not.toMatch(/<artifactId>\s*content-security-policy\s*<\/artifactId>/);
    });

    test('pom.xml contains no reference to content-security-policy at all', () => {
        expect(pomSource.toLowerCase()).not.toContain('content-security-policy');
    });
});
