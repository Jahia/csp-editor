/**
 * Tests for init.js — the selectorType-registration glue consumed by a hosting
 * Jahia UI via Module Federation (see webpack.config.js's `init` exposed module).
 *
 * F1 (SUPPORT-646 gap list, Tier 3): no test file for init.js existed before this.
 *
 * init.js has a MODULE-LEVEL side effect (`window.jahia.i18n.loadNamespaces('csp-editor')`,
 * init.js:4) that runs at import time, before `window.jahia` is guaranteed to exist in a
 * real host. To capture that call under test, `window.jahia` must be stubbed BEFORE the
 * module is imported, and each test needs a fresh module registry (jest.resetModules +
 * jest.isolateModules) so the import-time side effect actually re-fires per test rather
 * than being cached from a previous require.
 */

jest.mock('@jahia/ui-extender', () => ({
    registry: {add: jest.fn()}
}));

describe('init.js — registerCspPolicyEditor (F1)', () => {
    let loadNamespaces;
    let registryAdd;
    let registerCspPolicyEditor;
    let CspPolicyEditor;

    beforeEach(() => {
        jest.resetModules();
        loadNamespaces = jest.fn();
        window.jahia = {i18n: {loadNamespaces}};

        jest.isolateModules(() => {
            // Deliberately dynamic requires: must import after window.jahia is
            // stubbed above, and inside an isolated module registry so init.js's
            // module-level side effect (loadNamespaces) re-fires per test.
            registryAdd = require('@jahia/ui-extender').registry.add;
            registerCspPolicyEditor = require('./init').default;
            ({CspPolicyEditor} = require('./CspPolicyEditor/CspPolicyEditor'));
        });
    });

    afterEach(() => {
        delete window.jahia;
    });

    test('module-level side effect calls window.jahia.i18n.loadNamespaces("csp-editor") at import time', () => {
        expect(loadNamespaces).toHaveBeenCalledTimes(1);
        expect(loadNamespaces).toHaveBeenCalledWith('csp-editor');
    });

    test('registerCspPolicyEditor() registers the CspPolicyEditor selectorType with supportMultiple: false', () => {
        registerCspPolicyEditor();

        expect(registryAdd).toHaveBeenCalledTimes(1);
        const [type, name, options] = registryAdd.mock.calls[0];
        expect(type).toBe('selectorType');
        expect(name).toBe('CspPolicyEditor');
        // Referential equality: must be the exact component, not an equivalent copy.
        expect(options.cmp).toBe(CspPolicyEditor);
        expect(options.supportMultiple).toBe(false);
    });

    test('calling registerCspPolicyEditor() twice registers twice (no internal de-duplication)', () => {
        registerCspPolicyEditor();
        registerCspPolicyEditor();
        expect(registryAdd).toHaveBeenCalledTimes(2);
    });
});
