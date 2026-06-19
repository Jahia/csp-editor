import { DocumentNode } from 'graphql'
import { createSite, deleteSite, enableModule } from '@jahia/cypress'

/**
 * End-to-end confirmation that the csp-editor `CspPolicyEditor` selectorType is wired in.
 *
 * Flow:
 *   1. Create a dedicated site (createSite).
 *   2. Enable the companion content-security-policy module on it (enableModule). That module
 *      declares jmix:siteContentSecurityPolicy (extends jnt:virtualsite) and
 *      jmix:pageContentSecurityPolicy (extends jnt:page) as automatic mixins, so every site
 *      and page node then exposes a `policy` field.
 *   3. Confirm csp-editor overrides that field's editor:
 *      - API: the Content Editor form (forms.editForm) reports selectorType === "CspPolicyEditor"
 *        for the `policy` field. This is the exact value the Content Editor uses to pick the
 *        React component, so it is the definitive functional check.
 *      - Persistence: a policy value round-trips through the jcr GraphQL API on the site node.
 *      - UI: opening the Content Editor renders the custom editor (deterministic placeholder).
 */
describe('CSP Policy Editor', () => {
    const siteKey = 'cspEditorTest'
    const sitePath = `/sites/${siteKey}`
    const homePath = `/sites/${siteKey}/home`
    const templateSet = 'dx-base-demo-templates'
    const CSP_MODULE = 'content-security-policy'

    const SITE_CSP_FIELDSET = 'jmix:siteContentSecurityPolicy'
    const PAGE_CSP_FIELDSET = 'jmix:pageContentSecurityPolicy'
    const POLICY_FIELD = 'policy'
    const EXPECTED_SELECTOR = 'CspPolicyEditor'
    const SAMPLE_POLICY =
        "default-src 'self'; script-src 'nonce-{nonce}' 'strict-dynamic'; img-src https: data:; object-src 'none'"

    // The editor textarea placeholder is hard-coded in CspPolicyEditor.jsx, making it a stable
    // selector for locating the editor inside the Content Editor.
    const EDITOR_PLACEHOLDER_PREFIX = "e.g. default-src 'self'"

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const getEditForm: DocumentNode = require('graphql-tag/loader!../fixtures/graphql/query/getEditForm.graphql')
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const setCspPolicy: DocumentNode = require('graphql-tag/loader!../fixtures/graphql/mutation/setCspPolicy.graphql')
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const getNodeProperty: DocumentNode = require('graphql-tag/loader!../fixtures/graphql/query/getNodeProperty.graphql')

    // Locate a field's selectorType inside an editForm response, searching every section/fieldset.
    const selectorTypeOf = (
        sections: Array<{ fieldSets: Array<{ name: string; fields: Array<{ name: string; selectorType: string }> }> }>,
        fieldSetName: string,
        fieldName: string,
    ): string | undefined => {
        const fieldSets = (sections || []).flatMap((section) => section.fieldSets || [])
        const fieldSet = fieldSets.find((fs) => fs.name === fieldSetName)
        const field = (fieldSet?.fields || []).find((f) => f.name === fieldName)
        return field?.selectorType
    }

    before(() => {
        cy.login()
        createSite(siteKey, { languages: 'en', templateSet, serverName: 'localhost', locale: 'en' })
        // content-security-policy supplies the jmix:*ContentSecurityPolicy mixins (the `policy`
        // field). csp-editor supplies the jahia-content-editor-forms override that points that
        // field at the CspPolicyEditor selectorType — and that override only enters a site's form
        // registry when the module is enabled on the site, so both must be enabled here.
        enableModule(CSP_MODULE, siteKey)
        enableModule('csp-editor', siteKey)
    })

    after(() => {
        deleteSite(siteKey)
    })

    // ─── Selector wiring (API — the definitive check) ───────────────────────────────
    describe('selectorType wiring', () => {
        it('uses CspPolicyEditor for the policy field on the site node', () => {
            cy.login()
            cy.apollo({ query: getEditForm, variables: { uuidOrPath: sitePath, locale: 'en', uiLocale: 'en' } })
                .its('data.forms.editForm.sections')
                .then((sections) => {
                    expect(selectorTypeOf(sections, SITE_CSP_FIELDSET, POLICY_FIELD)).to.equal(EXPECTED_SELECTOR)
                })
        })

        it('uses CspPolicyEditor for the policy field on a page node', () => {
            cy.login()
            cy.apollo({ query: getEditForm, variables: { uuidOrPath: homePath, locale: 'en', uiLocale: 'en' } })
                .its('data.forms.editForm.sections')
                .then((sections) => {
                    expect(selectorTypeOf(sections, PAGE_CSP_FIELDSET, POLICY_FIELD)).to.equal(EXPECTED_SELECTOR)
                })
        })
    })

    // ─── Policy persistence (API) ───────────────────────────────────────────────────
    describe('policy persistence', () => {
        it('round-trips a policy value on the site node', () => {
            cy.login()
            cy.apollo({
                mutation: setCspPolicy,
                variables: { pathOrId: sitePath, mixin: SITE_CSP_FIELDSET, policy: SAMPLE_POLICY },
            })

            cy.apollo({ query: getNodeProperty, variables: { path: sitePath, propertyName: POLICY_FIELD } })
                .its('data.jcr.nodeByPath.property.value')
                .should('eq', SAMPLE_POLICY)
        })
    })

    // ─── Editor UI (Content Editor) ─────────────────────────────────────────────────
    describe('CSP Policy Editor UI', () => {
        const editorTextarea = () => cy.get(`textarea[placeholder^="${EDITOR_PLACEHOLDER_PREFIX}"]`, { timeout: 40000 })

        /**
         * Opens the Content Editor for the given page inside jContent. Navigating to the page's
         * jContent URL selects it; the toolbar "Edit" action then opens the Content Editor.
         *
         * NOTE: this drives the live jContent UI. If the route or toolbar changes across Jahia
         * versions, this helper is the single place to adjust.
         */
        const openContentEditor = (path: string) => {
            const relativePath = path.replace(`/sites/${siteKey}`, '')
            cy.visit(`/jahia/jcontent/${siteKey}/en/pages${relativePath}`)
            cy.contains('button', 'Edit', { timeout: 60000 }).should('be.visible').click()
            // The CSP `policy` field lives in the `options` section, shown as a collapsible in the
            // Edit tab once the editor is expanded via Advanced mode. Expand it to reveal the field.
            cy.contains(/advanced mode/i, { timeout: 30000 }).click()
            cy.contains('button.moonstone-collapsible_button', 'Options', { timeout: 30000 }).scrollIntoView().click()
            // jmix:pageContentSecurityPolicy is an activatable fieldset: the CspPolicyEditor only
            // renders once the page-level CSP toggle is checked.
            cy.contains(/Replace Content-Security-Policy at the page level/i, { timeout: 30000 })
                .scrollIntoView()
                .click()
        }

        it('renders the CspPolicyEditor and highlights CSP syntax', () => {
            cy.login()
            openContentEditor(homePath)

            // The `policy` field is an `options` itemtype, so it lives in an advanced section of
            // the form; scroll it into view before asserting the custom editor rendered.
            editorTextarea().scrollIntoView()
            editorTextarea().should('be.visible')
            cy.contains('button', 'Fullscreen').should('be.visible')

            editorTextarea().clear()
            editorTextarea().type("default-src 'self'", { parseSpecialCharSequences: false })

            // The backdrop overlay wraps recognised tokens in dedicated span classes.
            cy.get('.csp-directive').should('contain.text', 'default-src')
            cy.get('.csp-keyword').should('contain.text', "'self'")
        })
    })
})
