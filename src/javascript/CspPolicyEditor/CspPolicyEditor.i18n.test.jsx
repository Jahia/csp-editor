/**
 * F9 — real i18n wiring test (SUPPORT-646 gap list Tier 3, item 8).
 *
 * Deliberately lives in its OWN file, separate from CspPolicyEditor.test.jsx.
 * That file's module-level `jest.mock('react-i18next', ...)` (its `t` simply
 * echoes `defaultValue` back, CspPolicyEditor.test.jsx:7-9) would silently
 * shadow a real i18next import if this test were added there instead — every
 * assertion would then resolve against the mock's hardcoded fallback strings,
 * not against the actual shipped locale bundle, defeating the entire purpose
 * of proving the t() keys and en.json content actually agree.
 *
 * @jahia/moonstone's Button is still mocked here (same forwardRef pattern as
 * the main suite) — it is an unrelated, ESM-only design-system dependency;
 * only react-i18next/i18next are "real" in this file.
 */

jest.mock('@jahia/moonstone', () => {
    const React = require('react');
    return {
        // eslint-disable-next-line react/prop-types -- test mock, props come from the component under test
        Button: React.forwardRef(({label, onClick}, ref) => (
            <button ref={ref} type="button" onClick={onClick}>{label}</button>
        ))
    };
});

import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import i18next from 'i18next';
import {I18nextProvider, initReactI18next} from 'react-i18next';
import {CspPolicyEditor} from './CspPolicyEditor';
import enLocale from '../../main/resources/javascript/locales/en.json';

const NAMESPACE = 'csp-editor';

// `labelValue` becomes the `label` key inside the `csp-editor` namespace —
// i.e. the resource shape is {label: {cspPolicyEditor: {...}}}, matching the
// real en.json shape exactly, because the component's t() calls use the
// dotted key path 'label.cspPolicyEditor.<key>'. Getting this wrapper wrong
// makes every t() call silently miss and fall back to the hardcoded JSX
// default — which is the exact false-confidence failure mode this test
// exists to rule out, so the shape is deliberately kept explicit here.
const createRealI18n = labelValue => {
    const instance = i18next.createInstance();
    return instance.use(initReactI18next).init({
        lng: 'en',
        fallbackLng: 'en',
        ns: [NAMESPACE],
        defaultNS: NAMESPACE,
        resources: {en: {[NAMESPACE]: {label: labelValue}}},
        interpolation: {escapeValue: false},
        react: {useSuspense: false}
    }).then(() => instance);
};

describe('CspPolicyEditor — real i18n wiring (F9)', () => {
    let i18n;

    beforeEach(async () => {
        i18n = await createRealI18n(enLocale.label);
    });

    const renderWithRealI18n = props => render(
        <I18nextProvider i18n={i18n}>
            <CspPolicyEditor {...props}/>
        </I18nextProvider>
    );

    test('textarea aria-label resolves through real i18next to en.json\'s actual ariaLabel string', () => {
        renderWithRealI18n();
        expect(screen.getByLabelText(enLocale.label.cspPolicyEditor.ariaLabel)).toBeInTheDocument();
    });

    test('textarea placeholder resolves through real i18next to en.json\'s actual placeholder string', () => {
        renderWithRealI18n();
        const textarea = screen.getByLabelText(enLocale.label.cspPolicyEditor.ariaLabel);
        expect(textarea).toHaveAttribute('placeholder', enLocale.label.cspPolicyEditor.placeholder);
    });

    test('fullscreen button label resolves through real i18next to en.json\'s actual fullscreen string', () => {
        renderWithRealI18n();
        expect(screen.getByRole('button', {name: enLocale.label.cspPolicyEditor.fullscreen})).toBeInTheDocument();
    });

    test('entering fullscreen resolves exitFullscreen / fullscreenDialog / fullscreenHint from en.json', () => {
        renderWithRealI18n();
        fireEvent.click(screen.getByRole('button', {name: enLocale.label.cspPolicyEditor.fullscreen}));

        expect(screen.getByRole('button', {name: enLocale.label.cspPolicyEditor.exitFullscreen})).toBeInTheDocument();
        expect(screen.getByRole('heading', {name: enLocale.label.cspPolicyEditor.fullscreenDialog})).toBeInTheDocument();
        expect(screen.getByText(enLocale.label.cspPolicyEditor.fullscreenHint)).toBeInTheDocument();
    });

    // Proves resolution genuinely flows through the real i18next resource
    // bundle rather than through t()'s hardcoded JSX defaultValue fallback:
    // if the resource bundle is swapped for one with a deliberately different
    // string, the rendered output must follow the resource, not the fallback
    // ('Content Security Policy', hardcoded at CspPolicyEditor.jsx:279).
    test('renders the real resource bundle content, not the hardcoded JSX fallback string', async () => {
        const customAriaLabel = '__CUSTOM_ARIA_LABEL_FROM_RESOURCE_BUNDLE__';
        i18n = await createRealI18n({
            ...enLocale.label,
            cspPolicyEditor: {
                ...enLocale.label.cspPolicyEditor,
                ariaLabel: customAriaLabel
            }
        });

        renderWithRealI18n();

        expect(screen.getByLabelText(customAriaLabel)).toBeInTheDocument();
        expect(screen.queryByLabelText('Content Security Policy')).not.toBeInTheDocument();
    });

    // Every t('label.cspPolicyEditor.*', fallback) key used in CspPolicyEditor.jsx
    // (lines 246, 253-254, 279, 283, 293) must actually exist in en.json — catches
    // future key-name drift between the component and the locale file.
    test('every t() key used by CspPolicyEditor exists in en.json', () => {
        const keys = ['ariaLabel', 'placeholder', 'fullscreen', 'exitFullscreen', 'fullscreenDialog', 'fullscreenHint'];
        keys.forEach(key => {
            expect(enLocale.label.cspPolicyEditor).toHaveProperty(key);
            expect(typeof enLocale.label.cspPolicyEditor[key]).toBe('string');
            expect(enLocale.label.cspPolicyEditor[key].length).toBeGreaterThan(0);
        });
    });
});
