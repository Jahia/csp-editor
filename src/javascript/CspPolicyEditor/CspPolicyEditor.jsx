import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import PropTypes from 'prop-types';
import {useTranslation} from 'react-i18next';
import {Button} from '@jahia/moonstone';
import styles from './CspPolicyEditor.scss';

const FullscreenIcon = () => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true" focusable="false">
        <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
    </svg>
);

const ExitFullscreenIcon = () => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true" focusable="false">
        <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
    </svg>
);

// --- CSP syntax highlighter ----------------------------------------------------
// A backdrop <div> renders the highlighted markup behind a transparent <textarea>,
// so the two layers must share identical font metrics (see CspPolicyEditor.scss).

// Allow-list of CSP directive names used only for colouring. A token that does not
// match is rendered as plain text — a useful "possible typo" signal to the author.
// Reference: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy
const CSP_DIRECTIVES = new Set([
    'default-src',
    'script-src',
    'script-src-elem',
    'script-src-attr',
    'style-src',
    'style-src-elem',
    'style-src-attr',
    'img-src',
    'font-src',
    'connect-src',
    'frame-src',
    'object-src',
    'media-src',
    'child-src',
    'worker-src',
    'manifest-src',
    'prefetch-src',
    'navigate-to',
    'form-action',
    'frame-ancestors',
    'base-uri',
    'sandbox',
    'report-uri',
    'report-to',
    'upgrade-insecure-requests',
    'block-all-mixed-content',
    'require-trusted-types-for',
    'trusted-types',
    'plugin-types'
]);
const isCspDirective = word => CSP_DIRECTIVES.has(word.toLowerCase());
const SCHEME_ONLY_RE = /^(https?:|data:|blob:|filesystem:)$/;
const URL_RE = /^https?:\/\//;

// HTML entities for the characters that must never reach innerHTML unescaped.
const HTML_ESCAPES = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;'};

/**
 * HTML-escapes a string. The highlighter output is injected via
 * dangerouslySetInnerHTML, so every dynamic token MUST pass through this before
 * being wrapped in a (static) <span>. Quotes are escaped too so the function
 * remains safe even if a token is ever moved into an attribute-value position.
 *
 * @param {string} str raw, untrusted text
 * @returns {string} text safe to embed in HTML
 */
const escapeHtml = str => str.replace(/[&<>"']/g, ch => HTML_ESCAPES[ch]);

/**
 * Tokenises a CSP policy string and returns an HTML string with each token
 * wrapped in a semantic <span>.
 *
 * SAFE against XSS: every interpolated token is escaped via escapeHtml() before
 * interpolation; only the static <span> wrappers are literal HTML. Do not
 * interpolate any un-escaped value into the result.
 *
 * @param {string} text raw policy text
 * @returns {string} highlighted HTML (a trailing non-breaking space keeps the last empty line tall)
 */
const highlightCsp = text => {
    // Declared locally (the `g` flag makes it stateful) so re-entrant calls cannot
    // clash on lastIndex. Capture groups: 1=whitespace 2=semicolon 3=quoted 4=word.
    const tokenRe = /(\s+)|(;)|('(?:[^'\\]|\\.)*')|([^\s;']+)/g;
    let result = '';
    let match;

    while ((match = tokenRe.exec(text)) !== null) {
        const [, whitespace, semicolon, quoted, word] = match;

        if (whitespace) {
            result += escapeHtml(whitespace);
        } else if (semicolon) {
            result += '<span class="csp-sep">;</span>';
        } else if (quoted) {
            result += `<span class="csp-keyword">${escapeHtml(quoted)}</span>`;
        } else if (word) {
            const escaped = escapeHtml(word);
            if (isCspDirective(word)) {
                result += `<span class="csp-directive">${escaped}</span>`;
            } else if (SCHEME_ONLY_RE.test(word)) {
                result += `<span class="csp-scheme">${escaped}</span>`;
            } else if (word === '*') {
                result += `<span class="csp-wildcard">${escaped}</span>`;
            } else if (URL_RE.test(word)) {
                result += `<span class="csp-url">${escaped}</span>`;
            } else {
                result += escaped;
            }
        }
    }

    // Ensure the last line has height when content ends with a newline.
    return result + ' ';
};

// ------------------------------------------------------------------------------

/**
 * Content Editor selectorType component for editing Content-Security-Policy
 * strings, with syntax highlighting, a line-number gutter and a fullscreen mode.
 *
 * @param {object} props
 * @param {{readOnly?: boolean}} [props.field] Content Editor field descriptor
 * @param {string} [props.id] field id (used to build the textarea id)
 * @param {string} [props.value] current policy value
 * @param {(value: string) => void} [props.onChange] called with the new value
 */
export const CspPolicyEditor = ({field, id, onChange, value}) => {
    const {t} = useTranslation('csp-editor');
    const [isFullscreen, setIsFullscreen] = useState(false);
    const textareaRef = useRef(null);
    const lineNumbersRef = useRef(null);
    const backdropRef = useRef(null);
    const fullscreenButtonRef = useRef(null);
    const toolbarRef = useRef(null);
    const wasFullscreenRef = useRef(false);

    const isReadOnly = Boolean(field?.readOnly);
    const exitFullscreen = useCallback(() => setIsFullscreen(false), []);

    // While fullscreen: Escape exits, and Tab is trapped inside the overlay so
    // focus cannot escape into the visually-occluded Content Editor form behind it.
    // A document-level listener (rather than an onKeyDown prop on the dialog div)
    // keeps the container free of interactive handlers.
    useEffect(() => {
        if (!isFullscreen) {
            return undefined;
        }

        const handleKeyDown = e => {
            if (e.key === 'Escape') {
                exitFullscreen();
                return;
            }

            if (e.key !== 'Tab') {
                return;
            }

            const focusables = [fullscreenButtonRef.current, textareaRef.current].filter(Boolean);
            if (focusables.length === 0) {
                return;
            }

            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            const active = document.activeElement;

            if (e.shiftKey && active === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && active === last) {
                e.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isFullscreen, exitFullscreen]);

    // Move focus into the editor when entering fullscreen; restore it to the
    // toggle button when leaving (but not on the initial mount).
    // WCAG 2.4.3: @jahia/moonstone Button may not forward its ref to the DOM node,
    // so we fall back to the first focusable button inside the toolbar container.
    useEffect(() => {
        if (isFullscreen) {
            textareaRef.current?.focus();
        } else if (wasFullscreenRef.current) {
            const btn = fullscreenButtonRef.current;
            if (btn && typeof btn.focus === 'function') {
                btn.focus();
            } else {
                toolbarRef.current?.querySelector('button')?.focus();
            }
        }

        wasFullscreenRef.current = isFullscreen;
    }, [isFullscreen]);

    const handleScroll = useCallback(() => {
        const textarea = textareaRef.current;
        if (lineNumbersRef.current && textarea) {
            lineNumbersRef.current.scrollTop = textarea.scrollTop;
        }

        if (backdropRef.current && textarea) {
            backdropRef.current.scrollTop = textarea.scrollTop;
            backdropRef.current.scrollLeft = textarea.scrollLeft;
        }
    }, []);

    const lineNumbers = useMemo(
        () => (value || '').split('\n').map((_, i) => i + 1).join('\n'),
        [value]
    );
    const highlightedHtml = useMemo(() => highlightCsp(value || ''), [value]);

    const textareaId = `csp-policy-${id || 'field'}`;
    const hintId = `${textareaId}-fullscreen-hint`;
    const headingId = `${textareaId}-fullscreen-heading`;
    const textareaClassName = isReadOnly ? `${styles.textarea} ${styles.readOnly}` : styles.textarea;

    // Note: aria-modal alone does not prevent screen readers from leaving the
    // dialog in all implementations. Applying `inert` to background siblings
    // would be more robust but this component does not own the surrounding DOM.
    // Consumers who require full isolation should apply `inert` at the page level.

    return (
        <div
            aria-describedby={isFullscreen ? hintId : undefined}
            aria-labelledby={isFullscreen ? headingId : undefined}
            aria-modal={isFullscreen ? 'true' : undefined}
            className={isFullscreen ? styles.fullscreenContainer : styles.container}
            role={isFullscreen ? 'dialog' : undefined}
        >
            <div ref={toolbarRef} className={styles.toolbar}>
                {isFullscreen && (
                    <h2 className={styles.fullscreenHeading} id={headingId}>
                        {t('label.cspPolicyEditor.fullscreenDialog', 'CSP editor — fullscreen')}
                    </h2>
                )}
                <Button
                    ref={fullscreenButtonRef}
                    icon={isFullscreen ? <ExitFullscreenIcon/> : <FullscreenIcon/>}
                    label={isFullscreen ?
                        t('label.cspPolicyEditor.exitFullscreen', 'Exit fullscreen') :
                        t('label.cspPolicyEditor.fullscreen', 'Fullscreen')}
                    size="small"
                    variant="ghost"
                    onClick={() => setIsFullscreen(f => !f)}
                />
            </div>
            <div className={styles.editorWrapper}>
                <div
                    ref={lineNumbersRef}
                    aria-hidden="true"
                    className={styles.lineNumbers}
                >
                    {lineNumbers}
                </div>
                <div className={styles.highlightWrapper}>
                    <div
                        ref={backdropRef}
                        // eslint-disable-next-line react/no-danger -- highlightCsp escapes every dynamic token; only static <span> wrappers are literal HTML
                        dangerouslySetInnerHTML={{__html: highlightedHtml}}
                        aria-hidden="true"
                        className={styles.backdrop}
                    />
                    <textarea
                        ref={textareaRef}
                        aria-describedby={isFullscreen ? hintId : undefined}
                        aria-label={t('label.cspPolicyEditor.ariaLabel', 'Content Security Policy')}
                        aria-readonly={isReadOnly ? 'true' : undefined}
                        className={textareaClassName}
                        id={textareaId}
                        placeholder={t('label.cspPolicyEditor.placeholder', 'e.g. default-src \'self\'; script-src \'nonce-{nonce}\' \'strict-dynamic\'')}
                        readOnly={isReadOnly}
                        value={value || ''}
                        onChange={e => onChange && onChange(e.target.value)}
                        onScroll={handleScroll}
                    />
                </div>
            </div>
            {isFullscreen && (
                <span id={hintId} className={styles.srOnly}>
                    {t('label.cspPolicyEditor.fullscreenHint', 'Press Escape to exit fullscreen mode.')}
                </span>
            )}
        </div>
    );
};

CspPolicyEditor.propTypes = {
    field: PropTypes.shape({
        readOnly: PropTypes.bool
    }),
    id: PropTypes.string,
    onChange: PropTypes.func,
    value: PropTypes.string
};

// Exported for unit testing of the pure highlighter logic.
export {escapeHtml, highlightCsp};
