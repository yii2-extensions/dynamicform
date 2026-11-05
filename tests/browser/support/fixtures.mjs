import { test as base, expect } from '@playwright/test';

import { knownDefects } from './known-defects.mjs';

export { expect };

// Every unexpected page issue fails the test and is recorded as a `page-issue` annotation; page-issues-reporter.mjs
// fails the run on those annotations, so an uncaught error cannot be absorbed by a test that is expected to fail for a
// different, known reason.

export const test = base.extend({
  pageIssues: [
    async ({ page }, use, testInfo) => {
      const issues = [];

      page.on('pageerror', (error) => issues.push({ type: 'pageerror', message: error.message, stack: error.stack }));
      page.on('requestfailed', (request) =>
        issues.push({ type: 'requestfailed', url: request.url(), failure: request.failure()?.errorText ?? '' }),
      );
      page.on('response', (response) => {
        if (response.status() >= 400) {
          issues.push({ type: 'http', status: response.status(), url: response.url() });
        }
      });
      page.on('console', (message) => {
        if (message.type() === 'error') {
          issues.push({ type: 'console', text: message.text(), location: message.location() });
        }
      });

      await use(issues);

      // Only exact messages declared for this test and variant in known-defects.mjs are tolerated.
      const allowed = new Set(
        testInfo.annotations.filter((a) => a.type === 'allowed-page-error').map((a) => a.description),
      );
      const unexpected = [];

      for (const issue of issues) {
        if (issue.type === 'pageerror' && allowed.has(issue.message)) {
          testInfo.annotations.push({ type: 'expected-page-error', description: issue.message });
        } else {
          unexpected.push(issue);
          testInfo.annotations.push({ type: 'page-issue', description: JSON.stringify(issue) });
        }
      }

      if (unexpected.length > 0) {
        throw new Error(`Page issues: ${JSON.stringify(unexpected)}`);
      }
    },
    { auto: true },
  ],
});

/**
 * Marks the current test as an expected failure only for the asset variants listed in known-defects.mjs.
 *
 * Playwright reports an unexpected pass as a failure, so a fixed defect must be removed from the registry explicitly.
 */
export function expectKnownDefect(id) {
  const testInfo = test.info();
  const variant = testInfo.project.metadata.variant;
  const entry = knownDefects[id];

  if (entry === undefined) {
    throw new Error(`Unknown known-defect id ${id}.`);
  }

  const reason = entry.variants[variant];

  testInfo.annotations.push({ type: 'defect-id', description: id });

  if (reason !== undefined) {
    testInfo.annotations.push({ type: 'known-defect', description: `${variant}: ${reason}` });

    for (const message of entry.pageErrors?.[variant] ?? []) {
      testInfo.annotations.push({ type: 'allowed-page-error', description: message });
    }

    test.fail(true, `${id} (${variant}): ${reason}`);
  }
}
