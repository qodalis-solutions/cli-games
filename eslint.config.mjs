// ESLint flat config for the whole workspace (ESLint 9+), trimmed from web-cli's.
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
    globalIgnores(['**/dist/**', '**/node_modules/**', '**/coverage/**']),

    // ── TypeScript (every game) ─────────────────────────────────────────
    {
        files: ['**/*.ts', '**/*.mts', '**/*.cts'],
        extends: [js.configs.recommended, tseslint.configs.recommended],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: { ...globals.browser, ...globals.node },
        },
        rules: {
            quotes: ['error', 'single', { avoidEscape: true }],
            semi: ['error', 'always'],
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-this-alias': 'off',
            'no-prototype-builtins': 'off',
            'no-case-declarations': 'off',
            // A terminal library matches ANSI escape sequences (\x1b) on purpose.
            'no-control-regex': 'off',
        },
    },

    // ── Jasmine specs ───────────────────────────────────────────────────
    {
        files: ['**/*.spec.ts'],
        languageOptions: { globals: { ...globals.jasmine } },
    },

    // ── Plain JS tooling (workspace scripts, karma config) ──────────────
    {
        files: ['tools/**/*.js', '**/*.cjs'],
        extends: [js.configs.recommended],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'commonjs',
            globals: { ...globals.node },
        },
    },
    {
        files: ['**/*.mjs'],
        extends: [js.configs.recommended],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: { ...globals.node },
        },
    },

    // Prettier owns formatting; this must stay last.
    prettier,
]);
