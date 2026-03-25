import React from 'react';

const styles = {
    textarea: {
        width: '100%',
        minHeight: '120px',
        fontFamily: 'monospace',
        fontSize: '13px',
        padding: '8px',
        border: '1px solid #ccc',
        borderRadius: '3px',
        resize: 'vertical',
        boxSizing: 'border-box'
    }
};

export const CspPolicyEditor = ({field, id, value, onChange}) => {
    const handleChange = e => {
        if (onChange) {
            onChange(e.target.value);
        }
    };

    return (
        <textarea
            id={`csp-policy-${id || 'field'}`}
            value={value || ''}
            readOnly={field?.readOnly}
            onChange={handleChange}
            placeholder="e.g. default-src 'self'; script-src 'nonce-{nonce}' 'strict-dynamic'"
            style={styles.textarea}
        />
    );
};
