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
      // The whole plugin is covered; nothing is excluded from the report. Select2 and DepDrop run against the real
      // Kartik scripts (tests/js/kartik.test.js), TomSelect, Inputmask and the Kartik DatePicker, TimePicker, FileInput,
      // TouchSpin, MaskMoney and NumberControl against their real builds. Never lower these thresholds.
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
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
