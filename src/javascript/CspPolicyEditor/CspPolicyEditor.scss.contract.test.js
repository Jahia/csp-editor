/**
 * D1(a) — SCSS source-contract test (SUPPORT-646 gap list Tier 4, item 9).
 *
 * jest.config.js maps `\.(scss|css)$` to identity-obj-proxy (line 17-18), so no
 * real CSS value ever reaches jsdom in a component test — this is exactly why
 * this check is done by reading the SCSS file as raw text instead.
 *
 * This locks in TODAY'S actual `.editorWrapper` shape as a deliberate tripwire
 * for the documented D1 divergence: the README describes a "10-line default
 * height that scrolls beyond that", but the CSS only ever sets `min-height`
 * (never `height`/`max-height`) with `overflow: hidden` and no internal
 * scrollbar — i.e. the widget grows unbounded rather than clipping/scrolling.
 * If this test ever fails, it means the CSS shape changed — which could mean
 * either "the docs were finally fixed to match" or "this behavior regressed
 * back toward a bounded/scrolling shape"; either way it needs a conscious
 * choice about which side (code or docs) to reconcile, not a silent pass.
 */

const fs = require('fs');
const path = require('path');

const scssPath = path.join(__dirname, 'CspPolicyEditor.scss');
const scssSource = fs.readFileSync(scssPath, 'utf8');

/**
 * Extracts a brace-balanced rule block for an EXACT selector (matched as
 * `${selector} {`), so a compound selector like `.fullscreenContainer
 * .editorWrapper` is never mistaken for the base `.editorWrapper` rule (the
 * base rule appears earlier in the file, so the first match is correct).
 *
 * @param {string} source raw SCSS text
 * @param {string} selector exact selector text, e.g. '.editorWrapper'
 * @returns {string} the full rule block including braces
 */
const extractRuleBlock = (source, selector) => {
    const selectorIndex = source.indexOf(`${selector} {`);
    if (selectorIndex === -1) {
        throw new Error(`Selector "${selector}" not found in CspPolicyEditor.scss`);
    }

    const openBraceIndex = source.indexOf('{', selectorIndex);
    let depth = 0;
    let i = openBraceIndex;
    for (; i < source.length; i++) {
        if (source[i] === '{') {
            depth += 1;
        } else if (source[i] === '}') {
            depth -= 1;
            if (depth === 0) {
                break;
            }
        }
    }

    return source.slice(openBraceIndex, i + 1);
};

describe('CspPolicyEditor.scss — .editorWrapper contract (D1a, deliberate tripwire)', () => {
    const editorWrapperBlock = extractRuleBlock(scssSource, '.editorWrapper');

    test('has a min-height declaration referencing $editor-visible-lines', () => {
        expect(editorWrapperBlock).toMatch(/min-height:\s*calc\([^)]*\$editor-visible-lines/);
    });

    test('has NO unqualified `height:` declaration (only min-height is set)', () => {
        // Matches a `height:` property that is not part of `min-height:`/`max-height:`.
        const unqualifiedHeightRe = /(?<![\w-])height:/g;
        const matches = editorWrapperBlock.match(unqualifiedHeightRe) || [];
        // min-height's own colon is excluded by the negative lookbehind (preceded by "min-"),
        // so any remaining match would be a bare `height:` declaration.
        expect(matches).toHaveLength(0);
    });

    test('has NO max-height declaration', () => {
        expect(editorWrapperBlock).not.toMatch(/max-height:/);
    });

    test('has overflow: hidden (not overflow/overflow-y: auto)', () => {
        expect(editorWrapperBlock).toMatch(/overflow:\s*hidden/);
        expect(editorWrapperBlock).not.toMatch(/overflow(-y)?:\s*auto/);
    });
});
