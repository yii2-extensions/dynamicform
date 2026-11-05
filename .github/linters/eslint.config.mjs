/**
 * Flat-config ESLint rules for the distributed jQuery plugin and the JavaScript test/tooling code.
 *
 * Run through `npm run lint:js` (tests, tools and configuration) and `npm run lint:asset` (the plugin). Globals are
 * declared inline so the file resolves without extra packages. Formatting is not linted here.
 */
import js from '@eslint/js';

const browser = {
  CSS: 'readonly',
  console: 'readonly',
  document: 'readonly',
  queueMicrotask: 'readonly',
  setTimeout: 'readonly',
  window: 'readonly',
};

const node = {
  URL: 'readonly',
  console: 'readonly',
  process: 'readonly',
};

export default [
  {
    ignores: ['**/node_modules/**', 'internal/**', 'runtime/**', 'vendor/**', 'src/assets/*.min.js'],
  },
  {
    ...js.configs.recommended,
    files: ['src/assets/yii2-dynamic-form.js'],
    languageOptions: {
      // The distributed asset is loaded as a classic browser script; keep it ES5.
      ecmaVersion: 5,
      sourceType: 'script',
      globals: {
        window: 'readonly',
        jQuery: 'readonly',
        // Optional integrations resolved at runtime.
        TomSelect: 'readonly',
        initS2Loading: 'readonly',
        initSelect2DropStyle: 'readonly',
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      // jQuery and DepDrop callbacks receive positional arguments the plugin does not need.
      'no-unused-vars': ['error', { args: 'none' }],
    },
  },
  {
    ...js.configs.recommended,
    files: ['tests/js/**/*.js', 'tests/browser/**/*.mjs', 'tools/**/*.mjs', '*.config.mjs', '.github/linters/*.mjs'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...browser, ...node },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
];
