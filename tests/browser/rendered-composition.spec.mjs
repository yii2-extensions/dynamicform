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

/** Records the plugin events triggered on every element of the selector as `[index, event]` pairs in `window.hits`. */
const recordEvents = (page, selector) =>
  page.evaluate((target) => {
    window.hits = [];
    window.jQuery(target).each(function (index) {
      for (const name of ['beforeInsert', 'afterInsert', 'beforeDelete', 'afterDelete']) {
        window.jQuery(this).on(name, () => window.hits.push([index, name]));
      }
    });
  }, selector);

test('beforeInsert is reported only to the container that owns the clicked button', async ({ page }) => {
  expectKnownDefect('rendered-before-insert-owner');
  await openScenario(page, 'nested');

  await page.locator('.add-house').click();
  await recordEvents(page, '.dynamicform_inner');
  await page.locator('.house').nth(1).locator('.add-room').click();

  expect(await page.evaluate(() => window.hits), 'Only the second house may be notified').toEqual([
    [1, 'beforeInsert'],
    [1, 'afterInsert'],
  ]);
});

test('an inner widget rendered once per house shares one registration and acts on its own house', async ({ page }) => {
  expectKnownDefect('rendered-nested-repeated');
  await openScenario(page, 'nested-repeated');

  expect(
    await page.locator('.dynamicform_inner').evaluateAll((containers) => containers.map((c) => c.dataset.dynamicform)),
    'Both renderings must reference one options variable',
  ).toEqual(Array(2).fill(await page.locator('.dynamicform_inner').first().getAttribute('data-dynamicform')));

  await recordEvents(page, '.dynamicform_inner');
  await page.locator('.house').nth(1).locator('[data-test=add-room]').click();

  expect(await page.evaluate(() => window.hits), 'Events must reach the second house only, once').toEqual([
    [1, 'beforeInsert'],
    [1, 'afterInsert'],
  ]);
  expect(await nestedInputs(page), 'One room must be added to the second house').toEqual([
    'house-0-name|House[0][name]',
    'room-0-0-name|Room[0][0][name]',
    'house-1-name|House[1][name]',
    'room-1-0-name|Room[1][0][name]',
    'room-1-1-name|Room[1][1][name]',
    'room-1-2-name|Room[1][2][name]',
  ]);
  expect(await validatorIds(page, 'nested-form'), 'Inserted room must be validated').toEqual([
    'house-0-name',
    'house-1-name',
    'room-0-0-name',
    'room-1-0-name',
    'room-1-1-name',
    'room-1-2-name',
  ]);

  await expectSubmitBlocked(page, '#nested-form');
  await expect(page.locator('.field-room-1-2-name .help-block')).toHaveText('Name cannot be blank.');

  await page.locator('.house').nth(0).locator('[data-test=remove-room]').click();
  await expect(page.locator('.house').nth(0).locator('.room'), 'Minimum room must be kept').toHaveCount(1);
  await page.locator('.house').nth(1).locator('[data-test=remove-room]').first().click();
  await page.locator('#room-1-1-name').fill('r12');

  const payload = await submitAndCapture(page, '#nested-form');

  expect({ House: payload.post.House, Room: payload.post.Room }, 'Payload must mirror the remaining rooms').toEqual({
    House: [{ name: 'h0' }, { name: 'h1' }],
    Room: [[{ name: 'r00' }], [{ name: 'r11' }, { name: 'r12' }]],
  });
});

test('outer and inner widgets sharing button selectors act only on the widget that holds the button', async ({ page }) => {
  expectKnownDefect('rendered-nested-shared-buttons');
  await openScenario(page, 'nested-shared-buttons');

  const counts = async () => ({
    houses: await page.locator('.house').count(),
    rooms: await page.locator('.house').evaluateAll((houses) => houses.map((house) => house.querySelectorAll('.room').length)),
  });

  await recordEvents(page, '.dynamicform_outer, .dynamicform_inner');
  await page.locator('[data-test=add-room]').click();
  expect(await counts(), 'Inner insert must add one room only').toEqual({ houses: 1, rooms: [2] });

  await page.locator('[data-test=remove-room]').first().click();
  expect(await counts(), 'Inner delete must remove one room only').toEqual({ houses: 1, rooms: [1] });

  await page.locator('[data-test=add-house]').click();
  expect(await counts(), 'Outer insert must add one house with one room').toEqual({ houses: 2, rooms: [1, 1] });

  await page.locator('.house').nth(1).locator('[data-test=remove-house]').click();
  expect(await counts(), 'Outer delete must remove the house').toEqual({ houses: 1, rooms: [1] });

  expect(await page.evaluate(() => window.hits), 'Owner indexes: 0 outer, 1 inner').toEqual([
    [1, 'beforeInsert'],
    [1, 'afterInsert'],
    [1, 'beforeDelete'],
    [1, 'afterDelete'],
    [0, 'beforeInsert'],
    [0, 'afterInsert'],
    [0, 'beforeDelete'],
    [0, 'afterDelete'],
  ]);
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

test('two forms using one container name keep their own options, rows, validators and payloads', async ({ page }) => {
  expectKnownDefect('rendered-two-forms-same-container');
  await openScenario(page, 'two-forms-same-container');

  await page.locator('#form-b .add-item').first().click();
  await page.locator('#form-a .add-item').first().click();
  await page.locator('#form-a .add-item').first().click();

  expect(
    { a: await identities(page, 'form-a'), b: await identities(page, 'form-b') },
    'Form A must stop at its limit of 2; form B must insert with its own options',
  ).toEqual({
    a: ['formmodel-0-name|FormModel[0][name]|a0', 'formmodel-1-name|FormModel[1][name]|'],
    b: ['house-0-name|House[0][name]|b0', 'house-1-name|House[1][name]|b1', 'house-2-name|House[2][name]|'],
  });
  expect(
    [await validatorIds(page, 'form-a'), await validatorIds(page, 'form-b')],
    'Validators must follow the rows of each form',
  ).toEqual([
    ['formmodel-0-name', 'formmodel-1-name'],
    ['house-0-name', 'house-1-name', 'house-2-name'],
  ]);

  await expectSubmitBlocked(page, '#form-b');
  await expect(page.locator('.field-house-2-name .help-block')).toHaveText('Name cannot be blank.');

  await page.locator('#form-b .remove-item').first().click();
  await page.locator('#house-1-name').fill('b2');

  const payload = await submitAndCapture(page, '#form-b');

  expect(payload.post.House, 'Second form must submit its own rows').toEqual([{ name: 'b1' }, { name: 'b2' }]);
});

test('insert and delete selectors with quotes insert, delete, validate and submit rows', async ({ page }) => {
  expectKnownDefect('rendered-quoted-selector');
  await openScenario(page, 'quoted-selector');

  const rows = page.locator('.dynamicform_wrapper .container-items > .item');

  await rows.nth(0).locator('button[data-role="add"]').click();
  await rows.nth(1).locator('button[data-role="add"]').click();
  await expect(rows).toHaveCount(3);
  await rows.nth(1).locator('button[data-role="remove"]').click();
  await expect(rows).toHaveCount(2);
  expect(await validatorIds(page), 'One validator per remaining row').toEqual(['formmodel-0-name', 'formmodel-1-name']);

  await expectSubmitBlocked(page);
  await expect(page.locator('.field-formmodel-1-name .help-block')).toHaveText('Name cannot be blank.');

  await page.locator('#formmodel-1-name').fill('Second');

  const payload = await submitAndCapture(page);

  expect(payload.post.FormModel, 'Payload must contain the remaining rows').toEqual([
    { id: '1', name: 'Saved', code: 'A1' },
    { id: '', name: 'Second', code: '' },
  ]);
});

test('a form id with quotes and CSS syntax inserts, deletes and submits rows', async ({ page }) => {
  expectKnownDefect('rendered-special-form-id');
  await openScenario(page, 'special-form-id');

  const rows = page.locator('.dynamicform_wrapper .container-items > .item');

  expect(await page.locator('form').getAttribute('id'), 'Fixture must render the special id').toBe(
    'dynamic-form."v1\'</script>:[x]',
  );
  await rows.nth(0).locator('.add-item').click();
  await rows.nth(1).locator('.add-item').click();
  await expect(rows).toHaveCount(3);
  await rows.nth(0).locator('.remove-item').click();
  await expect(rows).toHaveCount(2);
  await page.locator('#formmodel-0-name').fill('First');

  const payload = await submitAndCapture(page, 'form');

  expect(payload.post.FormModel, 'Payload must contain the renumbered rows').toEqual([
    { id: '', name: 'First', code: '' },
    { id: '', name: '', code: '' },
  ]);
});
