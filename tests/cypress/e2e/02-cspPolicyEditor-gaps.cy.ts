import {DocumentNode} from 'graphql';
import {createSite, deleteSite, enableModule} from '@jahia/cypress';

/**
 * SUPPORT-646 Stage 5 — additional gap-closing Cypress specs.
 *
 * Covers Tier 5 (items 11-15) of the csp-editor gap list (04-gaps.md):
 *   - F3:   the site-level "Replace Content-Security-Policy at the site level" toggle
 *           (the existing 01-cspPolicyEditor.cy.ts spec only ever exercises the
 *           page-level toggle via its `openContentEditor` helper).
 *   - F11(b): graceful degradation when only csp-editor is enabled, without the
 *           companion content-security-policy module.
 *   - F10:  rem-based responsive sizing (computed-style, real browser only).
 *   - D1(b): real-browser proof of the documented unbounded-height divergence.
 *   - U3:   forced-colors mode fully disables syntax highlighting.
 *
 * STAGE 5 STATUS: written, linted and (where applicable) typechecked only.
 * None of these specs have been run against a live Jahia / the dockerized
 * Cypress harness in this stage — running the suite is Stage 6's job.
 */
describe('CSP Policy Editor — additional gap coverage', () => {
    const siteKey = 'cspEditorGapsTest';
    const sitePath = `/sites/${siteKey}`;
    const homePath = `/sites/${siteKey}/home`;
    const templateSet = 'dx-base-demo-templates';
    const CSP_MODULE = 'content-security-policy';
    const EDITOR_PLACEHOLDER_PREFIX = 'e.g. default-src \'self\'';

    const editorTextarea = () => cy.get(`textarea[placeholder^="${EDITOR_PLACEHOLDER_PREFIX}"]`, {timeout: 40000});

    // Same overlay-wait workaround as the existing spec (01-cspPolicyEditor.cy.ts):
    // the Content Editor's full-panel loading mask can intercept clicks on
    // collapsibles/toggles while it saves/loads.
    const waitForCeOverlayGone = () => {
        cy.get('body').then($body => {
            if ($body.find('[style*="color-light40"]').length > 0) {
                cy.get('[style*="color-light40"]', {timeout: 30000}).should('not.exist');
            }
        });
    };

    /**
     * Opens the Content Editor for the given path and reveals the CSP field by
     * toggling "Replace Content-Security-Policy at the <level> level".
     *
     * NOTE: this drives the live jContent UI. If the route or toolbar changes
     * across Jahia versions, this helper is the single place to adjust (mirrors
     * the equivalent helper in 01-cspPolicyEditor.cy.ts).
     */
    const openContentEditorAndRevealCsp = (path: string, level: 'page' | 'site') => {
        const relativePath = path.replace(`/sites/${siteKey}`, '') || '/home';
        cy.visit(`/jahia/jcontent/${siteKey}/en/pages${relativePath}`);
        cy.contains('button', 'Edit', {timeout: 60000}).should('be.visible').click();
        waitForCeOverlayGone();
        cy.contains(/advanced mode/i, {timeout: 30000}).click();
        waitForCeOverlayGone();
        cy.contains('button.moonstone-collapsible_button', 'Options', {timeout: 30000}).scrollIntoView();
        cy.contains('button.moonstone-collapsible_button', 'Options', {timeout: 30000}).click();
        waitForCeOverlayGone();
        cy.contains(new RegExp(`Replace Content-Security-Policy at the ${level} level`, 'i'), {timeout: 30000}).scrollIntoView();
        cy.contains(new RegExp(`Replace Content-Security-Policy at the ${level} level`, 'i'), {timeout: 30000}).click();
    };

    before(() => {
        cy.login();
        createSite(siteKey, {languages: 'en', templateSet, serverName: 'localhost', locale: 'en'});
        enableModule(CSP_MODULE, siteKey);
        enableModule('csp-editor', siteKey);
    });

    after(() => {
        deleteSite(siteKey);
    });

    // ─── F3 — site-level toggle ──────────────────────────────────────────────
    describe('site-level toggle (F3)', () => {
        it('renders the CspPolicyEditor when the site-level CSP toggle is enabled', () => {
            cy.login();
            openContentEditorAndRevealCsp(sitePath, 'site');

            editorTextarea().scrollIntoView();
            editorTextarea().should('be.visible');

            editorTextarea().clear();
            editorTextarea().type('default-src \'self\'', {parseSpecialCharSequences: false});

            cy.get('.csp-directive').should('contain.text', 'default-src');
            cy.get('.csp-keyword').should('contain.text', '\'self\'');
        });
    });

    // ─── F10 — rem-based responsive sizing ───────────────────────────────────
    describe('rem-based responsive sizing (F10)', () => {
        it('scales the editor font-size proportionally with the root font-size', () => {
            cy.login();
            openContentEditorAndRevealCsp(homePath, 'page');
            editorTextarea().scrollIntoView();

            let baselineFontSizePx = 0;
            cy.window().then(win => {
                editorTextarea().then($el => {
                    baselineFontSizePx = parseFloat(win.getComputedStyle($el[0]).fontSize);
                });
            });

            cy.document().then(doc => {
                doc.documentElement.style.fontSize = '32px'; // Double the 16px default
            });

            // Rem-based sizing should scale ~2x with the root font-size; allow a
            // tolerance band rather than exact equality (sub-pixel rounding).
            cy.window().then(win => {
                editorTextarea().should($scaled => {
                    const scaledFontSizePx = parseFloat(win.getComputedStyle($scaled[0]).fontSize);
                    expect(scaledFontSizePx).to.be.greaterThan(baselineFontSizePx * 1.8);
                    expect(scaledFontSizePx).to.be.lessThan(baselineFontSizePx * 2.2);
                });
            });
        });
    });

    // ─── D1(b) — real-browser unbounded-height proof ─────────────────────────
    describe('unbounded height — documentation divergence tripwire (D1b)', () => {
        // NOTE: this intentionally asserts TODAY'S documented-divergent behavior
        // (README says "shows 10 lines and scrolls beyond that"; the actual CSS
        // only sets min-height with overflow: hidden and no internal scrollbar —
        // see CspPolicyEditor.scss.contract.test.js for the Jest-side half of this
        // same tripwire). If D1 is ever resolved by making the editor genuinely
        // scroll internally, THESE SPECIFIC ASSERTIONS MUST FLIP — a failure here
        // may mean "good news, the divergence was fixed, update this test," not
        // necessarily a regression.
        it('grows unbounded rather than clipping to an internal scrollable viewport', () => {
            cy.login();
            openContentEditorAndRevealCsp(homePath, 'page');
            editorTextarea().scrollIntoView();

            editorTextarea().clear();
            editorTextarea().type('default-src \'self\'', {parseSpecialCharSequences: false});

            cy.get('[class*="editorWrapper"]').then($baseline => {
                const baselineHeight = $baseline[0].getBoundingClientRect().height;

                const longMultilinePolicy = Array.from({length: 20}, (_, i) => `frame-src 'self' ${i}`).join('\n');
                editorTextarea().clear();
                editorTextarea().type(longMultilinePolicy, {parseSpecialCharSequences: false, delay: 0});

                editorTextarea().should($el => {
                    const textarea = $el[0] as HTMLTextAreaElement;
                    // No internal scroll clipping: scrollHeight ~= clientHeight.
                    expect(textarea.scrollHeight - textarea.clientHeight).to.be.lessThan(4);
                });

                cy.get('[class*="editorWrapper"]').should($grown => {
                    const grownHeight = $grown[0].getBoundingClientRect().height;
                    expect(grownHeight).to.be.greaterThan(baselineHeight * 1.5);
                });
            });
        });
    });

    // ─── U3 — forced-colors disables highlighting ────────────────────────────
    describe('forced-colors mode disables syntax highlighting (U3)', () => {
        // HIGH RISK — flagged as the single biggest implementation risk in the
        // whole gap list (04-gaps.md item 15). CDP-level forced-colors emulation
        // via `Emulation.setEmulatedMedia` is Chromium-family-specific, has no
        // cross-browser equivalent in Cypress, and has NOT been exercised against
        // a live browser in Stage 5 (no dockerized Cypress run was performed this
        // stage — that is explicitly Stage 6's job). Stage 6 MUST verify this
        // actually works against the CI browser image before trusting it, and
        // should keep a documented manual-test fallback ready in case CDP
        // emulation proves unreliable there.
        it('removes the backdrop highlight layer under forced-colors: active', () => {
            cy.login();

            Cypress.automation('remote:debugger:protocol', {
                command: 'Emulation.setEmulatedMedia',
                params: {features: [{name: 'forced-colors', value: 'active'}]}
            });

            openContentEditorAndRevealCsp(homePath, 'page');
            editorTextarea().scrollIntoView();

            editorTextarea().clear();
            editorTextarea().type('default-src \'self\'', {parseSpecialCharSequences: false});

            cy.get('[class*="backdrop"]').should('not.be.visible');
            cy.get('.csp-directive').should('not.exist');
            cy.get('.csp-keyword').should('not.exist');
        });
    });
});

// ─── F11(b) — graceful degradation when only csp-editor is enabled ──────────
// Needs its OWN site fixture: the shared `before()` above always enables both
// modules together, so this cannot reuse it (per 04-gaps.md item 12's note).
describe('graceful degradation when only csp-editor is enabled (F11b)', () => {
    const soloSiteKey = 'cspEditorSoloTest';
    const soloSitePath = `/sites/${soloSiteKey}`;
    const templateSet = 'dx-base-demo-templates';
    const SITE_CSP_FIELDSET = 'jmix:siteContentSecurityPolicy';
    const POLICY_FIELD = 'policy';

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const getEditForm: DocumentNode = require('graphql-tag/loader!../fixtures/graphql/query/getEditForm.graphql');

    before(() => {
        cy.login();
        createSite(soloSiteKey, {languages: 'en', templateSet, serverName: 'localhost', locale: 'en'});
        // Deliberately do NOT enable content-security-policy on this site.
        enableModule('csp-editor', soloSiteKey);
    });

    after(() => {
        deleteSite(soloSiteKey);
    });

    it('the policy field/fieldset is simply absent, with no crash, when content-security-policy is not enabled', () => {
        cy.login();
        cy.apollo({query: getEditForm, variables: {uuidOrPath: soloSitePath, locale: 'en', uiLocale: 'en'}})
            .its('data.forms.editForm.sections')
            .then((sections: Array<{ fieldSets: Array<{ name: string; fields: Array<{ name: string }> }> }>) => {
                const fieldSets = (sections || []).flatMap(section => section.fieldSets || []);
                const fieldSet = fieldSets.find(fs => fs.name === SITE_CSP_FIELDSET);
                // The jmix:siteContentSecurityPolicy fieldset shouldn't be registered
                // at all (content-security-policy never enabled it); even if it
                // somehow were, the `policy` field itself must still be absent.
                const field = (fieldSet?.fields || []).find(f => f.name === POLICY_FIELD);
                expect(field).to.be.undefined;
            });
    });
});
