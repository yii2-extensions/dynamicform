// @ts-check

// The sandbox excludes `vendor/`; the test environment loads Yii's client scripts from this checkout instead.
process.env.DYNAMICFORM_LIBRARY_ROOT = process.cwd();

/** @type {import("@stryker-mutator/api/core").PartialStrykerOptions} */
const config = {
  ignorePatterns: ['/.agents', '/.claude', '/internal', '/runtime', '/vendor', '/playwright-report', '/test-results'],
  mutate: ['src/assets/yii2-dynamic-form.js'],
  testRunner: 'vitest',
  vitest: {
    configFile: 'vitest.mutation.config.mjs',
  },
  concurrency: 4,
  reporters: ['clear-text', 'progress', 'json'],
  jsonReporter: { fileName: 'runtime/stryker/mutation.json' },
  tempDirName: 'runtime/stryker-tmp',
  // Every mutant is killed: a new mutant needs a test, or the code it mutates is dead and goes. Never lower it.
  thresholds: {
    high: 100,
    low: 100,
    break: 100,
  },
};

export default config;
