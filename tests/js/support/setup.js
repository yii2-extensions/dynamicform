import { afterEach, beforeEach, vi } from 'vitest';

/**
 * Fails a test when anything is reported through `console.error` (jsdom reports unimplemented browser behavior and
 * script errors there), the jsdom counterpart of the page-error gate of the browser tests. Uncaught exceptions,
 * including errors jQuery rethrows from deferred callbacks, already fail the run as unhandled errors.
 */
let errors = [];

beforeEach(() => {
  errors = [];
  vi.spyOn(console, 'error').mockImplementation((...args) => {
    errors.push(args.map((arg) => (arg instanceof Error ? arg.message : String(arg))).join(' '));
  });
});

afterEach(() => {
  vi.restoreAllMocks();

  if (errors.length > 0) {
    throw new Error(`console.error was called: ${errors.join(' | ')}`);
  }
});
