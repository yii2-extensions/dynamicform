// PHP-rendered composition tests: nested widgets, several forms on one page and selector encoding in the click
// handlers PHP emits. Like rendered.spec.mjs, every handler and option comes from the PHP response.

import { expect, expectKnownDefect, test } from './support/fixtures.mjs';
import { expectSubmitBlocked, openScenario, submitAndCapture, validatorIds } from './support/rendered.mjs';

const nestedInputs = (page) =>
  page.locator('#nested-form .houses input[type=text]').evaluateAll((inputs) => inputs.map((input) => `${input.id}|${input.name}`));

test('nested rows renumber within their house and submit as nested arrays', async ({ page }) => {
  expectKnownDefect('rendered-nested-payload');
  await openScenario(page, 'nested');

  await page.locator('.house').nth(0).locator('.add-room').click();
  await page.locator('.add-house').click();
  await page.locator('.house').nth(1).locator('.add-room').click();
  await page.locator('.house').nth(0).locator('.remove-room').first().click();

  expect(await nestedInputs(page), 'Rooms must be numbered within their house').toEqual([
    'house-0-name|House[0][name]',
    'room-0-0-name|Room[0][0][name]',
    'house-1-name|House[1][name]',
    'room-1-0-name|Room[1][0][name]',
    'room-1-1-name|Room[1][1][name]',
  ]);

  await page.locator('#room-0-0-name').fill('r01');
  await page.locator('#house-1-name').fill('h1');
  await page.locator('#room-1-0-name').fill('r10');
  await page.locator('#room-1-1-name').fill('r11');

  const payload = await submitAndCapture(page, '#nested-form');

  expect({ House: payload.post.House, Room: payload.post.Room }, 'Payload must mirror the nesting').toEqual({
    House: [{ name: 'h0' }, { name: 'h1' }],
    Room: [[{ name: 'r01' }], [{ name: 'r10' }, { name: 'r11' }]],
  });
});

test('blank nested rows inserted through the PHP handlers are validated', async ({ page }) => {
  expectKnownDefect('rendered-nested-validation');
  await openScenario(page, 'nested');

  await page.locator('.add-house').click();

  expect(await validatorIds(page, 'nested-form'), 'One validator per visible input').toEqual([
    'house-0-name',
    'house-1-name',
    'room-0-0-name',
    'room-1-0-name',
  ]);
  await expectSubmitBlocked(page, '#nested-form');
  await expect(page.locator('.field-house-1-name .help-block')).toHaveText('Name cannot be blank.');
  await expect(page.locator('.field-room-1-0-name .help-block')).toHaveText('Name cannot be blank.');
});

test('beforeInsert is reported only to the container that owns the clicked button', async ({ page }) => {
  expectKnownDefect('rendered-before-insert-owner');
  await openScenario(page, 'nested');

  await page.locator('.add-house').click();
  await page.evaluate(() => {
    window.hits = [];
    window.jQuery('.dynamicform_inner').each(function (index) {
      window.jQuery(this).on('beforeInsert', () => window.hits.push(index));
    });
  });
  await page.locator('.house').nth(1).locator('.add-room').click();

  expect(await page.evaluate(() => window.hits), 'Only the second house may be notified').toEqual([1]);
});

const identities = (page, formId) =>
  page.locator(`#${formId} .items input[type=text]`).evaluateAll((inputs) =>
    inputs.map((input) => `${input.id}|${input.name}|${input.value}`),
  );

async function changeBothForms(page) {
  await openScenario(page, 'two-forms');
  await page.locator('#form-a .add-item').first().click();
  await page.locator('#form-b .remove-item').first().click();
}

test('two forms on one page keep their own rows and payloads', async ({ page }) => {
  expectKnownDefect('rendered-two-forms');
  await changeBothForms(page);

  expect(
    { a: await identities(page, 'form-a'), b: await identities(page, 'form-b') },
    'Each form must change only through its own widget',
  ).toEqual({
    a: ['formmodel-0-name|FormModel[0][name]|a0', 'formmodel-1-name|FormModel[1][name]|'],
    b: ['house-0-name|House[0][name]|b1'],
  });

  const payload = await submitAndCapture(page, '#form-b');

  expect(payload.post.House, 'Second form must submit only its remaining row').toEqual([{ name: 'b1' }]);
});

test('two forms on one page keep their own validators', async ({ page }) => {
  expectKnownDefect('rendered-two-forms-validators');
  await changeBothForms(page);

  expect(
    [await validatorIds(page, 'form-a'), await validatorIds(page, 'form-b')],
    'Validators must follow the rows of each form',
  ).toEqual([['formmodel-0-name', 'formmodel-1-name'], ['house-0-name']]);
});

test('an insert selector with double quotes still inserts a row', async ({ page }) => {
  expectKnownDefect('rendered-quoted-selector');
  await openScenario(page, 'quoted-selector');

  await page.locator('.add-item').first().click();

  await expect(page.locator('.dynamicform_wrapper .container-items > .item')).toHaveCount(2);
});
