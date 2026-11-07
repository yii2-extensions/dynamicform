// PHP-rendered integration tests with Yii's `MaskedInput` widget and the Inputmask 5.0.10 it publishes from
// `bower-asset/inputmask` (pinned in composer.json). `MaskedInput` masks each rendered input on DOM ready from the page
// variable its `data-plugin-inputmask` attribute names; DynamicForm masks the inputs of inserted rows from that same
// variable. Inputs are operated by typing, and read through Inputmask's documented jQuery API.

import { expect, expectKnownDefect, test } from './support/fixtures.mjs';
import { expectSubmitBlocked, openScenario, submitAndCapture } from './support/rendered.mjs';

const rowSelectors = {
  contacts: '#inputmask-form .container-items > .item',
  lines: '#zero-form .container-lines > .item',
  rooms: '#nested-form .rooms > .item',
};
const rows = (page, key) => page.locator(rowSelectors[key]);

/** Flags every Inputmask instance created by the page, so a replaced instance can be told from a kept one. */
const flagPageInstances = (page) =>
  page.evaluate(() => {
    document.querySelectorAll('input[data-plugin-inputmask]').forEach((input) => (input.inputmask.createdByPage = true));
  });

/** Returns the id, name, value and Inputmask state of every masked input of a form, in document order. */
const maskedInputs = (page, formId) =>
  page.evaluate(
    (id) =>
      Array.from(document.querySelectorAll(`#${id} input[data-plugin-inputmask]`), (input) => {
        const $input = window.jQuery(input);

        return {
          id: input.id,
          name: input.name,
          value: input.value,
          emptyMask: input.inputmask === undefined ? null : $input.inputmask('getemptymask'),
          clearIncomplete: input.inputmask?.opts.clearIncomplete ?? null,
          createdByPage: input.inputmask?.createdByPage === true,
        };
      }),
    formId,
  );

/** Counts the handlers Inputmask binds on a form (`submit.inputmask` and `reset.inputmask`, one pair per mask call). */
const formHandlers = (page, formId) =>
  page.evaluate((id) => {
    const events = window.jQuery._data(document.getElementById(id), 'events') ?? {};
    const count = (type) => (events[type] ?? []).filter((handler) => handler.namespace === 'inputmask').length;

    return { submit: count('submit'), reset: count('reset') };
  }, formId);

const duplicateIds = (page) =>
  page.evaluate(() => {
    const seen = new Map();

    document.querySelectorAll('[id]').forEach((element) => seen.set(element.id, (seen.get(element.id) ?? 0) + 1));

    return [...seen].filter(([, count]) => count > 1).map(([id]) => id);
  });

/** Types over the current content of an input, as a user who selects it first. */
async function type(page, id, text) {
  await page.locator(`#${id}`).selectText();
  await page.locator(`#${id}`).pressSequentially(text);
}

test('inserted rows are masked blank with the settings of their field; existing rows keep instance, value and options', async ({ page }) => {
  expectKnownDefect('rendered-inputmask-clones');
  await openScenario(page, 'inputmask');

  // The template is the server markup: the attribute naming the options, no Inputmask value or state.
  const template = await page.evaluate(() => {
    const $template = window.jQuery(window[document.querySelector('.dynamicform_contacts').getAttribute('data-dynamicform')].template);

    return $template.find('[data-plugin-inputmask]').map((_, input) => `${input.getAttribute('data-plugin-inputmask')}=${input.value}`).get();
  });

  expect(template).toEqual(['inputmask_99765a6a=', 'inputmask_34b2d533=']);

  // The page changes an option of one stored row through the Inputmask API, which masks that input again; the user
  // leaves another incomplete.
  await page.evaluate(() => window.jQuery('#contact-0-phone').inputmask('option', { placeholder: '*' }));
  await flagPageInstances(page);
  await type(page, 'contact-1-phone', '12');
  await page.locator('#inputmask-form .add-first').click();
  await expect(rows(page, 'contacts')).toHaveCount(3);
  await type(page, 'contact-2-phone', '5551234');
  await type(page, 'contact-2-code', 'xy9');
  await page.locator('#contact-2-name').click();

  expect(await maskedInputs(page, 'inputmask-form')).toEqual([
    { id: 'contact-0-phone', name: 'Contact[0][phone]', value: '555-0100', emptyMask: '***-****', clearIncomplete: false, createdByPage: true },
    { id: 'contact-0-code', name: 'Contact[0][code]', value: 'AB-123', emptyMask: '__-___', clearIncomplete: true, createdByPage: true },
    { id: 'contact-1-phone', name: 'Contact[1][phone]', value: '12_-____', emptyMask: '___-____', clearIncomplete: false, createdByPage: true },
    { id: 'contact-1-code', name: 'Contact[1][code]', value: 'CD-456', emptyMask: '__-___', clearIncomplete: true, createdByPage: true },
    // `clearIncomplete` of the `code` field empties its incomplete value on blur, in the clone as in stored rows.
    { id: 'contact-2-phone', name: 'Contact[2][phone]', value: '555-1234', emptyMask: '___-____', clearIncomplete: false, createdByPage: false },
    { id: 'contact-2-code', name: 'Contact[2][code]', value: '', emptyMask: '__-___', clearIncomplete: true, createdByPage: false },
    { id: 'outside-phone', name: 'outside', value: '555-0199', emptyMask: '___-____', clearIncomplete: false, createdByPage: true },
  ]);

  await type(page, 'contact-2-code', 'xy123');
  await expect(page.locator('#contact-2-code'), 'the clone applies the `AA-999` mask and its upper casing').toHaveValue('XY-123');
});

test('ids, names, labels and validators follow each masked input across deletion and reinsertion', async ({ page }) => {
  expectKnownDefect('rendered-inputmask-identity-validation');
  await openScenario(page, 'inputmask');

  await page.locator('#inputmask-form .add-first').click();
  await page.locator('#inputmask-form .add-first').click();
  await expect(rows(page, 'contacts')).toHaveCount(4);
  await type(page, 'contact-2-phone', '5552222');
  await rows(page, 'contacts').nth(1).locator('.remove-item').click();
  await expect(rows(page, 'contacts')).toHaveCount(3);

  const identity = await page.evaluate(() =>
    Array.from(document.querySelectorAll('#inputmask-form .container-items > .item input[data-plugin-inputmask]'), (input) => [
      input.id,
      input.name,
      input.closest('.form-group').classList.contains(`field-${input.id}`),
      input.closest('.form-group').querySelector('label').getAttribute('for'),
      window.jQuery('#inputmask-form').yiiActiveForm('find', input.id)?.input ?? null,
    ]),
  );

  expect(identity).toEqual([
    ['contact-0-phone', 'Contact[0][phone]', true, 'contact-0-phone', '#contact-0-phone'],
    ['contact-0-code', 'Contact[0][code]', true, 'contact-0-code', null],
    ['contact-1-phone', 'Contact[1][phone]', true, 'contact-1-phone', '#contact-1-phone'],
    ['contact-1-code', 'Contact[1][code]', true, 'contact-1-code', null],
    ['contact-2-phone', 'Contact[2][phone]', true, 'contact-2-phone', '#contact-2-phone'],
    ['contact-2-code', 'Contact[2][code]', true, 'contact-2-code', null],
  ]);
  expect(await duplicateIds(page)).toEqual([]);

  // The renumbered clone keeps its value; the blank clone fails its required phone and the name rule.
  await expect(page.locator('#contact-1-phone')).toHaveValue('555-2222');
  await expectSubmitBlocked(page, '#inputmask-form');
  await expect(page.locator('.field-contact-2-phone .help-block')).toHaveText('Phone cannot be blank.');
  await expect(page.locator('.field-contact-1-phone .help-block')).toHaveText('');

  // An incomplete mask is not a valid phone for the `match` rule.
  await type(page, 'contact-2-phone', '55');
  await page.locator('#contact-2-name').click();
  await expect(page.locator('.field-contact-2-phone .help-block')).toHaveText('Phone is invalid.');

  // Inputmask moves the caret after the last digit on `End`, so typing completes the mask.
  await page.locator('#contact-2-phone').press('End');
  await page.locator('#contact-2-phone').pressSequentially('53333');
  await page.locator('#contact-1-name').fill('c1');
  await page.locator('#contact-2-name').fill('c2');

  const payload = await submitAndCapture(page, '#inputmask-form');

  expect(payload.post.Contact).toEqual([
    { id: '1', name: 'n0', phone: '555-0100', code: 'AB-123' },
    { id: '', name: 'c1', phone: '555-2222', code: '' },
    { id: '', name: 'c2', phone: '555-3333', code: '' },
  ]);
  expect(payload.post.outside).toBe('555-0199');
});

test('Inputmask form handlers grow only with masked inputs DynamicForm creates, not per existing row and cycle', async ({ page }) => {
  expectKnownDefect('rendered-inputmask-form-handlers');
  await openScenario(page, 'inputmask');

  // One submit/reset pair per input the page masked: four in the rows and the input outside them.
  expect(await formHandlers(page, 'inputmask-form')).toEqual({ submit: 5, reset: 5 });

  await page.locator('#inputmask-form .add-first').click();
  await expect(rows(page, 'contacts')).toHaveCount(3);
  expect(await formHandlers(page, 'inputmask-form'), 'one pair per masked input of the clone').toEqual({ submit: 7, reset: 7 });

  for (let cycle = 0; cycle < 3; cycle++) {
    await page.locator('#inputmask-form .add-first').click();
    await rows(page, 'contacts').last().locator('.remove-item').click();
  }

  await expect(rows(page, 'contacts')).toHaveCount(3);
  // Inputmask 5.0.10 binds these handlers on the form and its `remove()` does not unbind them, so the pair of every
  // masked input of a deleted row stays bound: 7 + 3 cycles x 2 inputs.
  expect(await formHandlers(page, 'inputmask-form'), 'no pair added for the rows that stay').toEqual({ submit: 13, reset: 13 });
  expect(await formHandlers(page, 'zero-form'), 'independent form').toEqual({ submit: 0, reset: 0 });
  expect(await formHandlers(page, 'nested-form'), 'independent form').toEqual({ submit: 1, reset: 1 });
});

test('a form without rendered rows masks inserted rows, also after deleting the last row and inserting again', async ({ page }) => {
  expectKnownDefect('rendered-inputmask-zero-rows');
  await openScenario(page, 'inputmask');
  await flagPageInstances(page);

  await expect(rows(page, 'lines')).toHaveCount(0);
  await page.locator('#zero-form .add-first').click();
  await type(page, 'line-0-phone', '5550001');
  await rows(page, 'lines').first().locator('.remove-item').click();
  await expect(rows(page, 'lines')).toHaveCount(0);
  await page.locator('#zero-form .add-first').click();
  await type(page, 'line-0-phone', '5550002');
  await page.locator('#zero-form .add-first').click();
  await page.locator('#zero-form .add-first').click();
  await page.locator('#zero-form .add-first').click();
  await expect(rows(page, 'lines'), 'limit 3').toHaveCount(3);
  await page.evaluate(() => (document.getElementById('line-0-phone').inputmask.createdByPage = true));
  await rows(page, 'lines').nth(1).locator('.remove-item').click();

  expect(await maskedInputs(page, 'zero-form')).toEqual([
    { id: 'line-0-phone', name: 'Line[0][phone]', value: '555-0002', emptyMask: '___-____', clearIncomplete: false, createdByPage: true },
    { id: 'line-1-phone', name: 'Line[1][phone]', value: '', emptyMask: '___-____', clearIncomplete: false, createdByPage: false },
  ]);
  expect(await formHandlers(page, 'zero-form'), 'pairs of the 2 live and the 2 deleted masked inputs').toEqual({ submit: 4, reset: 4 });
  expect(
    (await maskedInputs(page, 'inputmask-form')).map((input) => [input.id, input.createdByPage]),
    'the other form keeps its instances',
  ).toEqual([
    ['contact-0-phone', true],
    ['contact-0-code', true],
    ['contact-1-phone', true],
    ['contact-1-code', true],
    ['outside-phone', true],
  ]);

  await expectSubmitBlocked(page, '#zero-form');
  await expect(page.locator('.field-line-1-phone .help-block')).toHaveText('Phone cannot be blank.');
  await expect(page.locator('.field-line-0-phone .help-block')).toHaveText('');
});

test('nested rows are masked under their own names and keep their instances when outer or inner rows change', async ({ page }) => {
  expectKnownDefect('rendered-inputmask-nested');
  await openScenario(page, 'inputmask');
  await flagPageInstances(page);

  await page.locator('#nested-form .add-room').click();
  await type(page, 'room-0-1-phone', '5550011');
  await page.locator('#nested-form .add-house').click();
  await page.locator('#nested-form .house').nth(1).locator('.add-room').click();
  await type(page, 'room-1-1-phone', '5551111');
  await rows(page, 'rooms').first().locator('.remove-room').click();

  expect(await maskedInputs(page, 'nested-form')).toEqual([
    { id: 'room-0-0-phone', name: 'Room[0][0][phone]', value: '555-0011', emptyMask: '___-____', clearIncomplete: false, createdByPage: false },
    { id: 'room-1-0-phone', name: 'Room[1][0][phone]', value: '', emptyMask: '___-____', clearIncomplete: false, createdByPage: false },
    { id: 'room-1-1-phone', name: 'Room[1][1][phone]', value: '555-1111', emptyMask: '___-____', clearIncomplete: false, createdByPage: false },
  ]);

  // Deleting the second house releases nothing the first house holds.
  await page.evaluate(() => (document.getElementById('room-0-0-phone').inputmask.createdByPage = true));
  await page.locator('#nested-form .house').nth(1).locator('.remove-house').click();
  await expect(page.locator('#nested-form .house')).toHaveCount(1);
  expect(await maskedInputs(page, 'nested-form')).toEqual([
    { id: 'room-0-0-phone', name: 'Room[0][0][phone]', value: '555-0011', emptyMask: '___-____', clearIncomplete: false, createdByPage: true },
  ]);
  expect(await duplicateIds(page)).toEqual([]);
});
