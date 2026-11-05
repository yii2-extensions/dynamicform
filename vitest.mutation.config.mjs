import base from './vitest.config.mjs';

/**
 * Mutation testing runs only the module-loaded source project, the variant Stryker instruments.
 */
export default {
  ...base,
  test: { ...base.test, projects: undefined, env: { DYNAMICFORM_JS_VARIANT: 'source' } },
};
