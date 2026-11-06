// PHP-rendered acceptance tests.
//
// Pages come from tests/Support/Browser: a real Yii web application renders ActiveForm and DynamicFormWidget through
// begin()/end(), registers DynamicFormAsset and emits the options JSON and click handlers. The browser loads the page
// over HTTP and operates the real controls; no handler is rebound here. The "source" project runs with YII_DEBUG=true
// and the "production" project with YII_DEBUG=false, so DynamicFormAsset selects the distributed file itself.

import { Buffer } from 'node:buffer';

import { expect, expectKnownDefect, test } from './support/fixtures.mjs';
import { expectSubmitBlocked, openScenario, submitAndCapture, validatorIds } from './support/rendered.mjs';

const rows = (page) => page.locator('.dynamicform_wrapper .container-items > .item');

const fieldNames = (page) =>
  rows(page).evaluateAll((items) =>
    items.map((item) =>
      Array.from(item.querySelectorAll('input')).map((input) => ({
        id: input.id,
        name: input.name,
        value: input.value,
        label: input.id === '' ? null : item.querySelector(`label[for="${input.id}"]`)?.textContent ?? null,
        container: input.closest('.form-group')?.className.match(/field-[\w-]+/)?.[0] ?? null,
      })),
    ),
  );

const blankError = 'Name cannot be blank.';

test('inserts and deletes rows with coherent names, ids and labels', async ({ page }) => {
  expectKnownDefect('rendered-insert-delete');
  await openScenario(page, 'validation');

  await expect(rows(page)).toHaveCount(1);
  await rows(page).nth(0).locator('.add-item').click();
  await expect(rows(page)).toHaveCount(2);

  expect(await fieldNames(page)).toEqual([
    [
      { id: 'formmodel-0-id', name: 'FormModel[0][id]', value: '1', label: null, container: null },
      { id: 'formmodel-0-name', name: 'FormModel[0][name]', value: 'Saved', label: 'Name', container: 'field-formmodel-0-name' },
      { id: 'formmodel-0-code', name: 'FormModel[0][code]', value: 'A1', label: 'Code', container: 'field-formmodel-0-code' },
    ],
    [
      { id: 'formmodel-1-id', name: 'FormModel[1][id]', value: '', label: null, container: null },
      { id: 'formmodel-1-name', name: 'FormModel[1][name]', value: '', label: 'Name', container: 'field-formmodel-1-name' },
      { id: 'formmodel-1-code', name: 'FormModel[1][code]', value: '', label: 'Code', container: 'field-formmodel-1-code' },
    ],
  ]);

  await page.locator('#formmodel-1-name').fill('Second');
  await rows(page).nth(0).locator('.remove-item').click();
  await expect(rows(page)).toHaveCount(1);

  expect(await fieldNames(page)).toEqual([
    [
      { id: 'formmodel-0-id', name: 'FormModel[0][id]', value: '', label: null, container: null },
      { id: 'formmodel-0-name', name: 'FormModel[0][name]', value: 'Second', label: 'Name', container: 'field-formmodel-0-name' },
      { id: 'formmodel-0-code', name: 'FormModel[0][code]', value: '', label: 'Code', container: 'field-formmodel-0-code' },
    ],
  ]);
});

test('submits the payload of existing and inserted rows', async ({ page }) => {
  expectKnownDefect('rendered-payload');
  await openScenario(page, 'validation');

  await rows(page).nth(0).locator('.add-item').click();
  await page.locator('#formmodel-1-name').fill('Second');
  await page.locator('#formmodel-1-code').fill('B2');

  const payload = await submitAndCapture(page);

  expect(payload.debug).toBe(test.info().project.metadata.variant === 'source');
  expect(payload.post.FormModel).toEqual([
    { id: '1', name: 'Saved', code: 'A1' },
    { id: '', name: 'Second', code: 'B2' },
  ]);
});

test('executes the required rule on an inserted row', async ({ page }) => {
  expectKnownDefect('rendered-required-rule');
  await openScenario(page, 'validation');

  await rows(page).nth(0).locator('.add-item').click();
  expect(await validatorIds(page)).toEqual(['formmodel-0-name', 'formmodel-1-name']);

  await expectSubmitBlocked(page);
  await expect(page.locator('.field-formmodel-1-name .help-block')).toHaveText(blankError);
  await expect(page.locator('.field-formmodel-1-name')).toHaveClass(/has-error/);
  await expect(page.locator('.field-formmodel-0-name .help-block')).toHaveText('');

  await page.locator('#formmodel-1-name').fill('Second');
  await page.locator('#formmodel-1-name').blur();
  await expect(page.locator('.field-formmodel-1-name .help-block')).toHaveText('');
});

test('inserts, deletes and submits without client validation', async ({ page }) => {
  expectKnownDefect('rendered-no-validation');
  await openScenario(page, 'no-validation');

  expect(await validatorIds(page)).toEqual([]);
  await rows(page).nth(0).locator('.add-item').click();
  await rows(page).nth(1).locator('.add-item').click();
  await expect(rows(page)).toHaveCount(3);
  await rows(page).nth(1).locator('.remove-item').click();
  await expect(rows(page)).toHaveCount(2);
  expect(await validatorIds(page)).toEqual([]);

  const payload = await submitAndCapture(page);

  expect(payload.post.FormModel).toEqual([
    { id: '1', name: 'Saved', code: 'A1' },
    { id: '', name: '', code: '' },
  ]);
});

test('validates rows inserted into an initially empty form (zero start)', async ({ page }) => {
  expectKnownDefect('rendered-zero-start');
  await openScenario(page, 'zero-start');

  await expect(rows(page)).toHaveCount(0);
  await page.locator('.add-first').click();
  await page.locator('.add-first').click();
  await expect(rows(page)).toHaveCount(2);
  await expect(page.locator('#formmodel-1-name')).toHaveAttribute('name', 'FormModel[1][name]');
  expect(await validatorIds(page)).toEqual(['formmodel-0-name', 'formmodel-1-name']);

  await expectSubmitBlocked(page);
  await expect(page.locator('.field-formmodel-0-name .help-block')).toHaveText(blankError);
  await expect(page.locator('.field-formmodel-1-name .help-block')).toHaveText(blankError);
});

test('keeps the numeric literal keys around the row index of rendered rows', async ({ page }) => {
  expectKnownDefect('rendered-numeric-literal-key');
  await openScenario(page, 'numeric-literal-key');

  const row = (index, id, name, code) => [
    { id: `formmodel-2024-${index}-id`, name: `FormModel[2024][${index}][id]`, value: id, label: null, container: null },
    {
      id: `formmodel-2024-${index}-name`,
      name: `FormModel[2024][${index}][name]`,
      value: name,
      label: 'Name',
      container: `field-formmodel-2024-${index}-name`,
    },
    {
      id: `formmodel-2024-${index}-7-code`,
      name: `FormModel[2024][${index}][7][code]`,
      value: code,
      label: 'Code',
      container: `field-formmodel-2024-${index}-7-code`,
    },
  ];

  await rows(page).nth(0).locator('.add-item').click();
  await rows(page).nth(1).locator('.add-item').click();
  await page.locator('#formmodel-2024-2-name').fill('Third');
  await page.locator('#formmodel-2024-2-7-code').fill('C3');
  await rows(page).nth(1).locator('.remove-item').click();
  await expect(rows(page)).toHaveCount(2);

  expect(await fieldNames(page), 'Only the row index may change').toEqual([row(0, '1', 'Saved', 'A1'), row(1, '', 'Third', 'C3')]);
  expect(await validatorIds(page)).toEqual(['formmodel-2024-0-name', 'formmodel-2024-1-name']);

  await rows(page).nth(1).locator('.add-item').click();
  await expectSubmitBlocked(page);
  await expect(page.locator('.field-formmodel-2024-2-name .help-block')).toHaveText(blankError);
  await expect(page.locator('.field-formmodel-2024-1-name .help-block')).toHaveText('');

  await page.locator('#formmodel-2024-2-name').fill('Fourth');

  const payload = await submitAndCapture(page);

  expect(payload.post.FormModel, 'Payload must keep both literal keys').toEqual({
    2024: [
      { id: '1', name: 'Saved', 7: { code: 'A1' } },
      { id: '', name: 'Third', 7: { code: 'C3' } },
      { id: '', name: 'Fourth', 7: { code: '' } },
    ],
  });
});

async function insertBeforeWindowLoad(page) {
  let releaseGate;
  const gate = new Promise((resolve) => {
    releaseGate = resolve;
  });

  // The gate image is answered here, so the fixture serves only pages and assets.
  await page.route('**/load-gate.gif', async (route) => {
    await gate;
    await route.fulfill({
      contentType: 'image/gif',
      body: Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'),
    });
  });
  await openScenario(page, 'preload', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.jQuery?.('#dynamic-form').data('yiiActiveForm') !== undefined);

  expect(await page.evaluate(() => document.readyState), 'window load must still be pending').not.toBe('complete');
  await rows(page).nth(0).locator('.add-item').click();
  await expect(rows(page)).toHaveCount(2);

  releaseGate();
  await page.waitForFunction(() => document.readyState === 'complete');
}

test('inserts a blank row before the window load initialization (pre-load)', async ({ page }) => {
  expectKnownDefect('rendered-preload-blank');
  await insertBeforeWindowLoad(page);

  await expect(page.locator('#formmodel-0-name')).toHaveValue('Saved');
  await expect(page.locator('#formmodel-1-name')).toHaveValue('');
  await expect(page.locator('#formmodel-1-code')).toHaveValue('');
});

test('validates a row inserted before the window load initialization (pre-load)', async ({ page }) => {
  expectKnownDefect('rendered-preload-validation');
  await insertBeforeWindowLoad(page);

  expect(await validatorIds(page)).toEqual(['formmodel-0-name', 'formmodel-1-name']);
  // Clear explicitly so this case does not depend on the separate blank-row expectation.
  await page.locator('#formmodel-1-name').fill('');
  await expectSubmitBlocked(page);
  await expect(page.locator('.field-formmodel-1-name .help-block')).toHaveText(blankError);
});

test('removes validation with the last row and restores it on insertion', async ({ page }) => {
  expectKnownDefect('rendered-last-row');
  await openScenario(page, 'last-row');

  await rows(page).nth(0).locator('.remove-item').click();
  await expect(rows(page)).toHaveCount(0);
  expect(await validatorIds(page)).toEqual([]);

  await page.locator('.add-first').click();
  await expect(rows(page)).toHaveCount(1);
  expect(await validatorIds(page)).toEqual(['formmodel-0-name']);

  await expectSubmitBlocked(page);
  await expect(page.locator('.field-formmodel-0-name .help-block')).toHaveText(blankError);
});
