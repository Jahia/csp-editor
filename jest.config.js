// Jest config for the React source. Babel is configured inline here (configFile:
// false) so the project's webpack-only Babel settings are never picked up and the
// two toolchains stay independent.
module.exports = {
    testEnvironment: 'jsdom',
    roots: ['<rootDir>/src/javascript'],
    transform: {
        '^.+\\.jsx?$': ['babel-jest', {
            configFile: false,
            babelrc: false,
            presets: [
                ['@babel/preset-env', {targets: {node: 'current'}}],
                '@babel/preset-react'
            ]
        }]
    },
    moduleNameMapper: {
        '\\.(scss|css)$': 'identity-obj-proxy'
    },
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
    collectCoverageFrom: ['src/javascript/CspPolicyEditor/CspPolicyEditor.jsx'],
    coverageThreshold: {
        global: {
            statements: 80,
            branches: 80,
            functions: 80,
            lines: 80
        }
    },
    testMatch: ['**/*.test.{js,jsx}']
};
