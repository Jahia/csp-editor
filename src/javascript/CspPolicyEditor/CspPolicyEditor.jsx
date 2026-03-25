import React, {useCallback, useEffect, useState} from 'react';
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

export const CspPolicyEditor = ({field, id, value, onChange}) => {
    const [isFullscreen, setIsFullscreen] = useState(false);

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
            <textarea
                id={`csp-policy-${id || 'field'}`}
                className={styles.textarea}
                value={value || ''}
                readOnly={field?.readOnly}
                onChange={e => onChange && onChange(e.target.value)}
                placeholder="e.g. default-src 'self'; script-src 'nonce-{nonce}' 'strict-dynamic'"
            />
        </div>
    );
};
