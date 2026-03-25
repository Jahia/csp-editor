import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Button} from '@jahia/moonstone';
import styles from './CspPolicyEditor.scss';

const FullscreenIcon = () => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
        <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
    </svg>
);

const ExitFullscreenIcon = () => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
        <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
    </svg>
);

// --- CSP highlighter -----------------------------------------------------------

const CSP_DIRECTIVE_RE = /^(default-src|script-src(?:-elem|-attr)?|style-src(?:-elem|-attr)?|img-src|font-src|connect-src|frame-src|object-src|media-src|child-src|worker-src|manifest-src|prefetch-src|navigate-to|form-action|frame-ancestors|base-uri|sandbox|report-uri|report-to|upgrade-insecure-requests|block-all-mixed-content|require-trusted-types-for|trusted-types|plugin-types)$/i;
const SCHEME_ONLY_RE = /^(https?:|data:|blob:|filesystem:)$/;
const URL_RE = /^https?:\/\//;
const TOKEN_RE = /(\s+)|(;)|('(?:[^'\\]|\\.)*')|([^\s;']+)/g;

const escapeHtml = str =>
    str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const highlightCsp = text => {
    let result = '';
    let match;
    TOKEN_RE.lastIndex = 0;

    while ((match = TOKEN_RE.exec(text)) !== null) {
        const [, whitespace, semicolon, quoted, word] = match;

        if (whitespace) {
            result += escapeHtml(whitespace);
        } else if (semicolon) {
            result += `<span class="csp-sep">;</span>`;
        } else if (quoted) {
            result += `<span class="csp-keyword">${escapeHtml(quoted)}</span>`;
        } else if (word) {
            const escaped = escapeHtml(word);
            if (CSP_DIRECTIVE_RE.test(word)) {
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

    // Ensure the last line has height when content ends with a newline
    return result + '\u00a0';
};

// ------------------------------------------------------------------------------

export const CspPolicyEditor = ({field, id, value, onChange}) => {
    const [isFullscreen, setIsFullscreen] = useState(false);
    const textareaRef = useRef(null);
    const lineNumbersRef = useRef(null);
    const backdropRef = useRef(null);

    const exitFullscreen = useCallback(() => setIsFullscreen(false), []);

    useEffect(() => {
        if (!isFullscreen) {
            return;
        }

        const handleKeyDown = e => {
            if (e.key === 'Escape') {
                exitFullscreen();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isFullscreen, exitFullscreen]);

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

    const lineNumbers = (value || '').split('\n').map((_, i) => i + 1).join('\n');
    const highlightedHtml = highlightCsp(value || '');

    return (
        <div className={isFullscreen ? styles.fullscreenContainer : styles.container}>
            <div className={styles.toolbar}>
                <Button
                    variant="ghost"
                    size="small"
                    icon={isFullscreen ? <ExitFullscreenIcon/> : <FullscreenIcon/>}
                    label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                    onClick={() => setIsFullscreen(f => !f)}
                />
            </div>
            <div className={styles.editorWrapper}>
                <div
                    ref={lineNumbersRef}
                    className={styles.lineNumbers}
                    aria-hidden="true"
                >
                    {lineNumbers}
                </div>
                <div className={styles.highlightWrapper}>
                    <div
                        ref={backdropRef}
                        className={styles.backdrop}
                        aria-hidden="true"
                        // eslint-disable-next-line react/no-danger
                        dangerouslySetInnerHTML={{__html: highlightedHtml}}
                    />
                    <textarea
                        ref={textareaRef}
                        id={`csp-policy-${id || 'field'}`}
                        className={styles.textarea}
                        value={value || ''}
                        readOnly={field?.readOnly}
                        onChange={e => onChange && onChange(e.target.value)}
                        onScroll={handleScroll}
                        placeholder="e.g. default-src 'self'; script-src 'nonce-{nonce}' 'strict-dynamic'"
                    />
                </div>
            </div>
        </div>
    );
};
