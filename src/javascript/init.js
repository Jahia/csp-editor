import {registry} from '@jahia/ui-extender';
import {CspPolicyEditor} from './CspPolicyEditor/CspPolicyEditor';

window.jahia.i18n.loadNamespaces('csp-editor');

export default function () {
    registry.add('selectorType', 'CspPolicyEditor', {
        cmp: CspPolicyEditor,
        supportMultiple: false
    });
}
