import js from '@eslint/js';
import globals from 'globals';
import security from 'eslint-plugin-security';
import sonarjs from 'eslint-plugin-sonarjs';
import unicorn from 'eslint-plugin-unicorn';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['node_modules/**', 'dist/**', 'web-ext-artifacts/**', '.remember/**'] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  sonarjs.configs.recommended,
  unicorn.configs['flat/recommended'],
  security.configs.recommended,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
      globals: { ...globals.browser, ...globals.webextensions },
    },
    rules: {
      'unicorn/prevent-abbreviations': 'off',
      'unicorn/no-null': 'off',
      'unicorn/prefer-query-selector': 'off',
      // Measurements like 1072.9 are not digit groups.
      'unicorn/numeric-separators-style': 'off',
      // Everything ships as a classic IIFE bundle; content scripts cannot be ES modules, so
      // top-level await is unavailable by construction.
      'unicorn/prefer-top-level-await': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      // Fights the idiomatic `need<HTMLInputElement>('id')` element-lookup helper.
      '@typescript-eslint/no-unnecessary-type-parameters': 'off',
    },
  },
  {
    // Plain build scripts are not part of the TS project; type-aware rules cannot run on them.
    files: ['build.js', 'eslint.config.js'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['test/**/*.ts', 'build.js', 'eslint.config.js'],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      'security/detect-non-literal-fs-filename': 'off',
      'sonarjs/no-nested-functions': 'off',
      // node:test's test() returns a promise that the runner owns; awaiting each is noise.
      '@typescript-eslint/no-floating-promises': 'off',
    },
  },
);
