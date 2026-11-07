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
      // Floors of the measured coverage; nothing is excluded from the report. Select2 and DepDrop run against the
      // real Kartik scripts (tests/js/kartik.test.js), TomSelect against its real build (tests/js/tomselect.test.js) and
      // Inputmask against its real build (tests/js/inputmask.test.js); the uncovered code is the remaining third-party
      // restore logic (Kartik pickers, maskMoney, fileinput, TouchSpin, Spectrum, NumberControl), whose versioned
      // fixtures belong to later Phase 5 blocks. Raise
      // these floors with that work; never lower them.
      thresholds: {
        branches: 91,
        functions: 87,
        lines: 89,
        statements: 89,
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
