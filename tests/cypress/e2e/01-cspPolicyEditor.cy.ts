import {DocumentNode} from 'graphql';

/**
 * The csp-editor module registers a `CspPolicyEditor` selectorType and, via the
 * jahia-content-editor-forms fieldsets, binds it to the `policy` field of two mixins
 * supplied by the companion content-security-policy module:
 *   - jmix:siteContentSecurityPolicy (on the site node)
 *   - jmix:pageContentSecurityPolicy (on page nodes)
 *
 * The suite is split in two:
 *   1. "CSP policy data contract" — deterministic, API-level checks that the mixins exist
 *      and the `policy` property round-trips through the generic jcr GraphQL API. This is
 *      the contract the editor depends on and is what runs reliably in CI.
 *   2. "CSP Policy Editor UI" — opens the Content Editor and asserts the custom editor
 *      renders and behaves. The Content Editor navigation depends on the running jContent
 *      UI; the selectors below favour the editor's deterministic textarea placeholder.
 */
describe('CSP Policy Editor', () => {
    const siteKey = 'digitall';
    const sitePath = `/sites/${siteKey}`;
    const homePath = `/sites/${siteKey}/home`;

    const SITE_CSP_MIXIN = 'jmix:siteContentSecurityPolicy';
    const PAGE_CSP_MIXIN = 'jmix:pageContentSecurityPolicy';
    const POLICY_PROP = 'policy';
    const SAMPLE_POLICY =
        "default-src 'self'; script-src 'nonce-{nonce}' 'strict-dynamic'; img-src https: data:; object-src 'none'";

    // The editor textarea placeholder is hard-coded in CspPolicyEditor.jsx, which makes it a
    // stable, implementation-anchored selector for locating the editor in the Content Editor.
    const EDITOR_PLACEHOLDER_PREFIX = "e.g. default-src 'self'";

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const addMixin: DocumentNode = require('graphql-tag/loader!../fixtures/graphql/mutation/addMixin.graphql');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const setNodeProperty: DocumentNode = require('graphql-tag/loader!../fixtures/graphql/mutation/setNodeProperty.graphql');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const getNodeProperty: DocumentNode = require('graphql-tag/loader!../fixtures/graphql/query/getNodeProperty.graphql');

    before(() => {
        cy.login();
    });

    // ─── Data contract (API) ───────────────────────────────────────────────────────
    describe('CSP policy data contract (API)', () => {
        it('persists a policy on the site node via jmix:siteContentSecurityPolicy', () => {
            cy.apollo({mutation: addMixin, variables: {pathOrId: sitePath, mixins: [SITE_CSP_MIXIN]}});
            cy.apollo({
                mutation: setNodeProperty,
                variables: {pathOrId: sitePath, propertyName: POLICY_PROP, propertyValue: SAMPLE_POLICY}
            });

            cy.apollo({query: getNodeProperty, variables: {path: sitePath, propertyName: POLICY_PROP}})
                .its('data.jcr.nodeByPath.property.value')
                .should('eq', SAMPLE_POLICY);
        });

        it('persists a policy on a page node via jmix:pageContentSecurityPolicy', () => {
            cy.apollo({mutation: addMixin, variables: {pathOrId: homePath, mixins: [PAGE_CSP_MIXIN]}});
            cy.apollo({
                mutation: setNodeProperty,
                variables: {pathOrId: homePath, propertyName: POLICY_PROP, propertyValue: SAMPLE_POLICY}
            });

            cy.apollo({query: getNodeProperty, variables: {path: homePath, propertyName: POLICY_PROP}})
                .its('data.jcr.nodeByPath.property.value')
                .should('eq', SAMPLE_POLICY);
        });

        it('clears the policy when an empty value is stored', () => {
            cy.apollo({mutation: addMixin, variables: {pathOrId: homePath, mixins: [PAGE_CSP_MIXIN]}});
            cy.apollo({
                mutation: setNodeProperty,
                variables: {pathOrId: homePath, propertyName: POLICY_PROP, propertyValue: ''}
            });

            cy.apollo({query: getNodeProperty, variables: {path: homePath, propertyName: POLICY_PROP}})
                .its('data.jcr.nodeByPath.property.value')
                .should('eq', '');
        });
    });

    // ─── Editor UI (Content Editor) ─────────────────────────────────────────────────
    describe('CSP Policy Editor UI', () => {
        const editorTextarea = () =>
            cy.get(`textarea[placeholder^="${EDITOR_PLACEHOLDER_PREFIX}"]`, {timeout: 30000});

        /**
         * Opens the Content Editor for the given node path. The page node must already carry
         * the jmix:pageContentSecurityPolicy mixin so that the `policy` field (and therefore
         * the CspPolicyEditor) is rendered.
         *
         * NOTE: this navigation drives the live jContent UI. If the route changes across Jahia
         * versions, this is the single place to adjust.
         */
        const openContentEditor = (path: string) => {
            const relativePath = path.replace(`/sites/${siteKey}`, '');
            cy.visit(`/jahia/jcontent/${siteKey}/en/pages${relativePath}`);
            // Open the editor for the selected page via the Edit action.
            cy.get('[data-sel-role="edit"], button[data-sel-role="editButton"]', {timeout: 30000})
                .first()
                .click();
        };

        beforeEach(() => {
            cy.login();
            // Ensure the page exposes the CSP policy field before opening the editor.
            cy.apollo({mutation: addMixin, variables: {pathOrId: homePath, mixins: [PAGE_CSP_MIXIN]}});
        });

        it('renders the CspPolicyEditor with a fullscreen toggle', () => {
            openContentEditor(homePath);

            editorTextarea().should('be.visible');
            cy.contains('button', 'Fullscreen').should('be.visible');
        });

        it('highlights CSP directives and quoted keywords as the user types', () => {
            openContentEditor(homePath);

            editorTextarea().clear();
            editorTextarea().type("default-src 'self'", {parseSpecialCharSequences: false});

            // The backdrop overlay wraps recognised tokens in dedicated span classes.
            cy.get('.csp-directive').should('contain.text', 'default-src');
            cy.get('.csp-keyword').should('contain.text', "'self'");
        });

        it('toggles fullscreen and exits with the Escape key', () => {
            openContentEditor(homePath);

            cy.contains('button', 'Fullscreen').click();
            cy.contains('button', 'Exit fullscreen').should('be.visible');

            cy.get('body').type('{esc}');
            cy.contains('button', 'Fullscreen').should('be.visible');
        });
    });
});
