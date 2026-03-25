import {registry} from '@jahia/ui-extender';
import {CspPolicyEditor} from './CspPolicyEditor';

window.jahia.i18n.loadNamespaces('csp-editor');

export default function () {
    registry.add('selectorType', 'CspPolicyEditor', {
        cmp: CspPolicyEditor,
        supportMultiple: false
    });
}

console.debug('%c csp-editor CspPolicyEditor selectorType registered', 'color: #3c8cba');
