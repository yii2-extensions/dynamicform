import { test } from 'vitest';

import { assetVariant } from './environment.js';
import { knownDefects } from './known-defects.js';

const strict = process.env.DYNAMICFORM_STRICT_DEFECTS === '1';

/**
 * Declares a test whose body asserts the correct contract, tolerating only the failure recorded for this variant.
 *
 * Without a registry entry for the current variant this is a plain `test()`. With one, the test passes only when the
 * body fails with an error whose message contains the recorded failure; any other error is rethrown and a passing body
 * fails with "no longer reproduces".
 */
export function defectTest(id, title, body) {
  const registered = knownDefects[id];

  if (registered === undefined) {
    throw new Error(`Unknown known-defect id ${id}.`);
  }

  const entry = registered[assetVariant];

  if (entry === undefined || strict) {
    test(title, body);

    return;
  }

  test(`${title} [known defect ${id}]`, async (context) => {
    try {
      await body(context);
    } catch (error) {
      if (!String(error?.message).includes(entry.failure)) {
        throw error;
      }

      context.annotate?.(`${id} (${assetVariant}): ${entry.finding}`, 'known-defect');

      return;
    }

    throw new Error(`Known defect ${id} (${assetVariant}) no longer reproduces; remove its registry entry with the fix.`);
  });
}
