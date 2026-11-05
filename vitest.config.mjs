import { defineConfig } from 'vitest/config';

/**
 * Fast plugin contract tests in jsdom (`tests/js`), one project per asset variant; see tests/js/support/environment.js.
 * Coverage is measured on the module-loaded source; the minified file is exercised by the `production` project.
 */
const variants = ['source', 'source-script', 'production'];

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/assets/yii2-dynamic-form.js'],
      reporter: ['text', 'json-summary'],
      reportsDirectory: 'runtime/coverage-js',
      // Floors of the measured coverage; nothing is excluded from the report. The
      // uncovered code is the third-party restore logic (Inputmask, Kartik pickers, maskMoney, fileinput, TouchSpin,
      // Spectrum, DepDrop, TomSelect, NumberControl), whose versioned fixtures belong to Phase 5. Raise these floors
      // with that work; never lower them.
      thresholds: {
        branches: 76,
        functions: 66,
        lines: 74,
        statements: 74,
      },
    },
    environment: 'jsdom',
    include: ['tests/js/**/*.test.js'],
    pool: 'threads',
    setupFiles: ['tests/js/support/setup.js'],
    projects: variants.map((variant) => ({
      extends: true,
      test: { name: variant, env: { DYNAMICFORM_JS_VARIANT: variant } },
    })),
  },
});
