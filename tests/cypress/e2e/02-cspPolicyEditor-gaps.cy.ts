import {DocumentNode} from 'graphql';
import {createSite, deleteSite, enableModule} from '@jahia/cypress';

/**
 * SUPPORT-646 Stage 5 — additional gap-closing Cypress specs.
 *
 * Covers Tier 5 (items 11-15) of the csp-editor gap list (04-gaps.md):
 *   - F3:   the site-level Content-Security-Policy toggle (the existing
 *           01-cspPolicyEditor.cy.ts spec only ever exercises the page-level
 *           toggle via its `openContentEditor` helper).
 *   - F11(b): graceful degradation when only csp-editor is enabled, without the
 *           companion content-security-policy module.
 *   - F10:  rem-based responsive sizing (computed-style, real browser only).
 *   - D1(b): real-browser proof of the documented unbounded-height divergence.
 *   - U3:   forced-colors mode fully disables syntax highlighting.
 *
 * STAGE 6 UPDATE: these specs were run for real against a dockerized Jahia +
 * Cypress (Electron/Chromium) stack. Four genuine test bugs were found and
 * fixed in-suite (none are product bugs). U3's CDP forced-colors mechanism
 * itself (04-gaps.md's flagged "highest risk" item) worked correctly on the
 * first try and needed no fallback — see the U3 describe block below for the
 * live-verification note.
 *
 * 1. F3 navigation bug: `openContentEditorAndRevealCsp`'s relativePath fallback
 *    (`path.replace(...) || '/home'`) sent the 'site' level case to the site's
 *    HOME PAGE instead of the site node itself, so the site-level toggle was
 *    never actually on screen. The site node has no entry in jContent's Pages
 *    tree, so it can't be reached by clicking "Edit" there at all. Fixed by
 *    fetching the site node's uuid via GraphQL (same pattern as
 *    01-cspPolicyEditor.cy.ts's `getNodeProperty` query) and navigating
 *    directly to the Content Editor's uuid-addressed URL fragment — this is
 *    exactly how @jahia/jcontent's own "Edit" button constructs the URL after
 *    a click, just skipping the (nonexistent) tree-click step. Verified live
 *    via a throwaway debug spec before landing this fix.
 * 2. F3 label-text bug: even after reaching the right node, the toggle's real
 *    label is "**Add** Content-Security-Policy at the site level" — not
 *    "Replace ... at the site level" like the page-level toggle. This
 *    asymmetry is real content-security-policy-module i18n (a dependency this
 *    module doesn't own), not a bug in either module. Fixed by matching the
 *    stable substring `Content-Security-Policy at the site level` (regardless
 *    of verb) rather than assuming "Replace".
 * 3. D1(b)/U3 selector bug: `[class*="editorWrapper"]` / `[class*="backdrop"]`
 *    can never match in a real browser. `CspPolicyEditor.scss`'s classes are
 *    real CSS Modules (`webpack.config.js`'s `css-loader` with
 *    `modules: {mode: 'local'}`), so `styles.editorWrapper` / `styles.backdrop`
 *    compile to opaque hashes (confirmed in the built bundle:
 *    `locals={...,editorWrapper:"WEpP5spyyqFuzdocHyFu",...}`) with no
 *    "editorWrapper"/"backdrop" substring anywhere in the real DOM. Jest tests
 *    never caught this because `identity-obj-proxy` (Jest's css-module mock)
 *    passes class names through unchanged, masking the divergence — this is
 *    exactly the kind of gap real-browser Cypress coverage exists to catch.
 *    `.csp-directive` / `.csp-keyword` are unaffected: `highlightCsp()` writes
 *    those as literal strings via `dangerouslySetInnerHTML`, never through
 *    `styles.*`. Fixed by locating the wrapper/backdrop via stable DOM
 *    relationships to the textarea (`.parent().parent()` and `.prev()`)
 *    instead of hashed class names.
 * 4. U3 assertion bug: forced-colors hides the backdrop via `display: none`
 *    (confirmed: `backdrop().should('not.be.visible')` passes), but that does
 *    NOT remove its highlighted `<span class="csp-directive">`/`csp-keyword`
 *    children from the DOM — they're still there, just invisible along with
 *    their hidden ancestor. The original `.should('not.exist')` assertions
 *    failed live ("continuously found"). Fixed to `.should('not.be.visible')`,
 *    matching the actual (correct, accessible) implementation.
 */
describe('CSP Policy Editor — additional gap coverage', () => {
    const siteKey = 'cspEditorGapsTest';
    const sitePath = `/sites/${siteKey}`;
    const homePath = `/sites/${siteKey}/home`;
    const templateSet = 'dx-base-demo-templates';
    const CSP_MODULE = 'content-security-policy';
    const EDITOR_PLACEHOLDER_PREFIX = 'e.g. default-src \'self\'';

    const editorTextarea = () => cy.get(`textarea[placeholder^="${EDITOR_PLACEHOLDER_PREFIX}"]`, {timeout: 40000});

    // `.editorWrapper`/`.backdrop` are real CSS Modules classes (see the Stage 6
    // update note above) — they compile to opaque per-build hashes in the real
    // browser bundle, so `[class*="..."]` selectors against them can never
    // match. Locate them via their stable DOM relationship to the textarea
    // instead: textarea -> highlightWrapper (parent) -> editorWrapper (parent);
    // textarea's previous sibling within highlightWrapper is the backdrop div
    // (see CspPolicyEditor.jsx's render tree).
    const editorWrapper = () => editorTextarea().parent().parent();
    const backdrop = () => editorTextarea().prev();

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const getNodeProperty: DocumentNode = require('graphql-tag/loader!../fixtures/graphql/query/getNodeProperty.graphql');

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
     * toggling the "Content-Security-Policy at the <level> level" checkbox.
     *
     * NOTE: this drives the live jContent UI. If the route or toolbar changes
     * across Jahia versions, this helper is the single place to adjust (mirrors
     * the equivalent helper in 01-cspPolicyEditor.cy.ts).
     *
     * The 'site' level is a special case: the site node (jnt:virtualsite) has
     * no entry of its own in jContent's Pages tree — only pages underneath it
     * do — so there is no "select it, then click Edit" path. Content Editor
     * addresses whatever node it's editing by uuid in the URL fragment (visible
     * after clicking Edit on a page: `#(contentEditor:!((...,uuid:'<uuid>')))`),
     * so we fetch the site node's uuid via GraphQL and construct that URL
     * directly instead — verified live against this harness before landing.
     * The site node's form also has no "Advanced mode" toggle (unlike the page
     * form): its Options section is already expanded, so that step is skipped.
     */
    const openContentEditorAndRevealCsp = (path: string, level: 'page' | 'site') => {
        if (level === 'site') {
            cy.apollo({query: getNodeProperty, variables: {path, propertyName: 'jcr:title'}})
                .its('data.jcr.nodeByPath.uuid')
                .then((uuid: string) => {
                    cy.visit(
                        `/jahia/jcontent/${siteKey}/en/pages/home#(contentEditor:!((formKey:modal_0,isFullscreen:!t,lang:en,mode:edit,sideBySideContext:(),uilang:en,uuid:'${uuid}')))`
                    );
                    cy.contains('button.moonstone-collapsible_button', 'Options', {timeout: 30000}).scrollIntoView();
                    cy.contains('button.moonstone-collapsible_button', 'Options', {timeout: 30000}).click();
                    waitForCeOverlayGone();
                    cy.contains(/Content-Security-Policy at the site level/i, {timeout: 30000}).scrollIntoView();
                    cy.contains(/Content-Security-Policy at the site level/i, {timeout: 30000}).click();
                });
            return;
        }

        const relativePath = path.replace(`/sites/${siteKey}`, '');
        cy.visit(`/jahia/jcontent/${siteKey}/en/pages${relativePath}`);
        cy.contains('button', 'Edit', {timeout: 60000}).should('be.visible').click();
        waitForCeOverlayGone();
        cy.contains(/advanced mode/i, {timeout: 30000}).click();
        waitForCeOverlayGone();
        cy.contains('button.moonstone-collapsible_button', 'Options', {timeout: 30000}).scrollIntoView();
        cy.contains('button.moonstone-collapsible_button', 'Options', {timeout: 30000}).click();
        waitForCeOverlayGone();
        cy.contains(/Content-Security-Policy at the page level/i, {timeout: 30000}).scrollIntoView();
        cy.contains(/Content-Security-Policy at the page level/i, {timeout: 30000}).click();
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

            editorWrapper().then($baseline => {
                const baselineHeight = $baseline[0].getBoundingClientRect().height;

                const longMultilinePolicy = Array.from({length: 20}, (_, i) => `frame-src 'self' ${i}`).join('\n');
                editorTextarea().clear();
                editorTextarea().type(longMultilinePolicy, {parseSpecialCharSequences: false, delay: 0});

                editorTextarea().should($el => {
                    const textarea = $el[0] as HTMLTextAreaElement;
                    // No internal scroll clipping: scrollHeight ~= clientHeight.
                    expect(textarea.scrollHeight - textarea.clientHeight).to.be.lessThan(4);
                });

                editorWrapper().should($grown => {
                    const grownHeight = $grown[0].getBoundingClientRect().height;
                    expect(grownHeight).to.be.greaterThan(baselineHeight * 1.5);
                });
            });
        });
    });

    // ─── U3 — forced-colors disables highlighting ────────────────────────────
    describe('forced-colors mode disables syntax highlighting (U3)', () => {
        // STAGE 6 RESOLUTION of the "HIGH RISK" flag from 04-gaps.md item 15:
        // `Cypress.automation('remote:debugger:protocol', {command:
        // 'Emulation.setEmulatedMedia', ...})` DOES work reliably against this
        // harness's browser target (`cypress.config.ts` runs the bundled
        // Electron browser, which is Chromium-based and exposes the same CDP
        // surface Chrome does). Verified directly, independent of this spec,
        // via a throwaway debug spec asserting
        // `win.matchMedia('(forced-colors: active)').matches === true` right
        // after the automation call — it was `true` on every run. No flakiness
        // was observed across repeated runs; this is not being kept as a
        // skip/manual-test fallback. (The one real bug the forced-colors state
        // surfaced was in this test's own assertions — see below and the
        // Stage 6 file-header note — not in the CDP mechanism itself.)
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

            // The backdrop div is hidden via `display: none` (see
            // CspPolicyEditor.scss's `@media (forced-colors: active)` block) —
            // it is NOT removed from the DOM, so its highlighted <span> children
            // are still present, just invisible along with their hidden
            // ancestor. `not.exist` (found to fail live: the spans are
            // "continuously found") is the wrong assertion for that; the
            // correct check is that they render, but are not visible.
            backdrop().should('not.be.visible');
            cy.get('.csp-directive').should('not.be.visible');
            cy.get('.csp-keyword').should('not.be.visible');
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
