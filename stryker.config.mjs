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
  // `break` is the floor of the score measured when this layer was introduced (52.68%); surviving and uncovered
  // mutants are classified in the private test-architecture record. Raise it with new tests; never lower it.
  thresholds: {
    high: 80,
    low: 60,
    break: 52,
  },
};

export default config;
