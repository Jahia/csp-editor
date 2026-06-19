// Babel config used by tooling that resolves a project-wide config — primarily
// @babel/eslint-parser (so ESLint can parse JSX/modern syntax) and, if invoked
// without an inline config, Jest. The webpack build and the Jest transform both
// set `configFile: false`, so this file never affects the browser bundle.
module.exports = {
    presets: [
        ['@babel/preset-env', {targets: {node: 'current'}}],
        '@babel/preset-react'
    ],
    plugins: ['@babel/plugin-syntax-dynamic-import']
};
