import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { expect, test } from './fixtures.mjs';

const assetPattern = /\/yii2-dynamic-form(\.min)?\.js$/;

/**
 * Opens a PHP-rendered scenario and verifies that exactly one DynamicForm asset was served and that its bytes equal
 * the file the project expects (`source` or `production`). The served path and hash are recorded as an annotation.
 */
export async function openScenario(page, scenario, { waitUntil = 'load' } = {}) {
  const assetResponses = [];

  page.on('response', (response) => {
    if (assetPattern.test(new URL(response.url()).pathname)) {
      assetResponses.push(response);
    }
  });

  await page.goto(`form/${scenario}`, { waitUntil });
  await expect.poll(() => assetResponses.length, { message: 'DynamicForm asset must be requested' }).toBe(1);

  const testInfo = test.info();
  const expected = testInfo.project.metadata.asset;
  const response = assetResponses[0];
  const pathname = new URL(response.url()).pathname;
  const served = createHash('sha256').update(await response.body()).digest('hex');
  const onDisk = createHash('sha256').update(readFileSync(expected)).digest('hex');

  testInfo.annotations.push({ type: 'asset', description: `${pathname} sha256=${served}` });
  expect(pathname.endsWith(`/${expected.split('/').pop()}`), 'selected asset file').toBe(true);
  expect(served, `served asset must equal ${expected}`).toBe(onDisk);
}

/** Returns the sorted ids of the attributes registered in the form's ActiveForm. */
export const validatorIds = (page, formId = 'dynamic-form') =>
  page.evaluate(
    (id) => window.jQuery(`#${id}`).data('yiiActiveForm').attributes.map((attribute) => attribute.id).sort(),
    formId,
  );

/** Clicks the submit button of the form and returns the payload echoed by the fixture controller. */
export async function submitAndCapture(page, formSelector = '#dynamic-form') {
  const [request] = await Promise.all([
    page.waitForRequest((candidate) => candidate.method() === 'POST' && candidate.url().includes('/submit/')),
    page.locator(`${formSelector} button.submit`).click(),
  ]);
  const response = await request.response();

  return response.json();
}

/** Clicks submit and asserts that client validation prevented any POST request. */
export async function expectSubmitBlocked(page, formSelector = '#dynamic-form') {
  let posted = false;
  const listener = (request) => {
    if (request.method() === 'POST') {
      posted = true;
    }
  };

  page.on('request', listener);
  await page.locator(`${formSelector} button.submit`).click();
  await page.waitForTimeout(300);
  page.off('request', listener);

  expect(posted, 'client validation must block submission').toBe(false);
}
