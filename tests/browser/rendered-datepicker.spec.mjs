// PHP-rendered integration tests with Kartik DatePicker 1.4.8 (pinned in composer.json), which publishes its fork of
// bootstrap-datepicker 1.8.0 as `jQuery.fn.kvDatepicker`. The widget names the page variable holding the plugin options
// in `data-krajee-kvdatepicker` and initializes the input itself for `TYPE_INPUT` (`data-datepicker-type` 1) and the
// element around the input for the other types; DynamicForm initializes the controls of inserted rows the same way.
// Dates are picked by clicking the calendar, and read through the instance bootstrap-datepicker keeps in jQuery data.

import { expect, expectKnownDefect, test } from './support/fixtures.mjs';
import { expectSubmitBlocked, openScenario, submitAndCapture } from './support/rendered.mjs';

const rowSelectors = {
  tasks: '#datepicker-form .container-items > .item',
  lines: '#zero-form .container-lines > .item',
  rooms: '#nested-form .rooms > .item',
};
const rows = (page, key) => page.locator(rowSelectors[key]);

/** Flags every current DatePicker instance; `kept` of {@see datePickers} tells a flagged instance from a new one. */
const flagInstances = (page) =>
  page.evaluate(() => {
    document.querySelectorAll('*').forEach((element) => {
      const picker = window.jQuery(element).data('datepicker');

      if (picker) {
        picker.flagged = true;
      }
    });
  });

/**
 * Returns, for every DatePicker input of a form in document order, its id, name and value, the element its instance
 * belongs to, the element `data-datepicker-source` names, the date the calendar selects and whether the instance is
 * flagged. `null` stands for a missing instance.
 */
const datePickers = (page, formId) =>
  page.evaluate(
    (id) =>
      Array.from(document.querySelectorAll(`#${id} input[data-krajee-kvdatepicker]`), (input) => {
        const element = input.getAttribute('data-datepicker-type') === '1' ? input : input.parentElement;
        const picker = window.jQuery(element).data('datepicker');

        return {
          id: input.id,
          name: input.name,
          value: input.value,
          picker: picker === undefined ? null : element.id,
          source: input.getAttribute('data-datepicker-source'),
          selected: picker === undefined ? null : picker.getFormattedDate(),
          kept: picker?.flagged === true,
        };
      }),
    formId,
  );

/** Counts the DatePicker instances of a form and the inline calendars rendered in it. */
const instanceCounts = (page, formId) =>
  page.evaluate((id) => {
    const elements = Array.from(document.getElementById(id).querySelectorAll('*'));

    return {
      instances: elements.filter((element) => window.jQuery(element).data('datepicker') !== undefined).length,
      inline: elements.filter((element) => element.matches('.datepicker-inline')).length,
    };
  }, formId);

/** Counts the `mousedown` handlers on the document; bootstrap-datepicker binds one per shown calendar. */
const documentHandlers = (page) => page.evaluate(() => (window.jQuery._data(document, 'events')?.mousedown ?? []).length);

const duplicateIds = (page) =>
  page.evaluate(() => {
    const seen = new Map();

    document.querySelectorAll('[id]').forEach((element) => seen.set(element.id, (seen.get(element.id) ?? 0) + 1));

    return [...seen].filter(([, count]) => count > 1).map(([id]) => id);
  });

/** Opens the calendar of an input by clicking it and picks a day of the month the calendar shows. */
async function pick(page, id, day) {
  await page.locator(`#${id}`).click();
  await page.locator('.datepicker-dropdown:visible td.day:not(.old):not(.new)').getByText(String(day), { exact: true }).click();
}

test('inserted rows get their own blank DatePicker of each type; existing rows keep their instance and date', async ({ page }) => {
  expectKnownDefect('rendered-datepicker-clones');
  await openScenario(page, 'datepicker');
  await flagInstances(page);

  expect(await instanceCounts(page, 'datepicker-form')).toEqual({ instances: 7, inline: 2 });

  await page.locator('#datepicker-form .add-first').click();
  await expect(rows(page, 'tasks')).toHaveCount(3);

  expect(await instanceCounts(page, 'datepicker-form'), 'one instance per control, one calendar per inline control').toEqual({
    instances: 10,
    inline: 3,
  });
  expect(await datePickers(page, 'datepicker-form')).toEqual([
    { id: 'task-0-date', name: 'Task[0][date]', value: '2025-03-10', picker: 'task-0-date-kvdate', source: 'task-0-date-kvdate', selected: '2025-03-10', kept: true },
    { id: 'task-0-due', name: 'Task[0][due]', value: '2025-04-01', picker: 'task-0-due', source: 'task-0-due', selected: '2025-04-01', kept: true },
    { id: 'task-0-start', name: 'Task[0][start]', value: '2025-02-03', picker: 'task-0-start-kvdate', source: 'task-0-start-kvdate', selected: '2025-02-03', kept: true },
    { id: 'task-1-date', name: 'Task[1][date]', value: '2025-05-20', picker: 'task-1-date-kvdate', source: 'task-1-date-kvdate', selected: '2025-05-20', kept: true },
    { id: 'task-1-due', name: 'Task[1][due]', value: '2025-06-02', picker: 'task-1-due', source: 'task-1-due', selected: '2025-06-02', kept: true },
    { id: 'task-1-start', name: 'Task[1][start]', value: '2025-05-04', picker: 'task-1-start-kvdate', source: 'task-1-start-kvdate', selected: '2025-05-04', kept: true },
    // The inline calendar of the clone selects no date: the date of the template row is not carried over.
    { id: 'task-2-date', name: 'Task[2][date]', value: '', picker: 'task-2-date-kvdate', source: 'task-2-date-kvdate', selected: '', kept: false },
    { id: 'task-2-due', name: 'Task[2][due]', value: '', picker: 'task-2-due', source: 'task-2-due', selected: '', kept: false },
    { id: 'task-2-start', name: 'Task[2][start]', value: '', picker: 'task-2-start-kvdate', source: 'task-2-start-kvdate', selected: '', kept: false },
    { id: 'outside-date', name: 'outside', value: '2025-12-24', picker: 'outside-date-kvdate', source: 'outside-date-kvdate', selected: '2025-12-24', kept: true },
  ]);

  // The calendars of the clone open on the `defaultViewDate` of their field, and write the configured format.
  await pick(page, 'task-2-date', 15);
  await pick(page, 'task-2-due', 16);
  await page.locator('#task-2-start-kvdate td.day:not(.old):not(.new)').getByText('17', { exact: true }).click();

  await expect(page.locator('#task-2-date')).toHaveValue('2026-01-15');
  await expect(page.locator('#task-2-due')).toHaveValue('2026-01-16');
  await expect(page.locator('#task-2-start')).toHaveValue('2026-01-17');
  await expect(page.locator('#task-0-date'), 'the stored row is unchanged').toHaveValue('2025-03-10');
});

test('ids, names, labels and validators follow each DatePicker across deletion and reinsertion', async ({ page }) => {
  expectKnownDefect('rendered-datepicker-identity-validation');
  await openScenario(page, 'datepicker');

  await page.locator('#datepicker-form .add-first').click();
  await page.locator('#datepicker-form .add-first').click();
  await expect(rows(page, 'tasks')).toHaveCount(4);
  await pick(page, 'task-2-date', 5);
  await pick(page, 'task-2-due', 6);
  await rows(page, 'tasks').nth(1).locator('.remove-item').click();
  await expect(rows(page, 'tasks')).toHaveCount(3);

  const identity = await page.evaluate(() =>
    Array.from(document.querySelectorAll('#datepicker-form .container-items > .item input[data-krajee-kvdatepicker]'), (input) => [
      input.id,
      input.name,
      input.closest('.form-group').classList.contains(`field-${input.id}`),
      input.closest('.form-group').querySelector('label').getAttribute('for'),
      window.jQuery('#datepicker-form').yiiActiveForm('find', input.id)?.input ?? null,
    ]),
  );

  expect(identity).toEqual([
    ['task-0-date', 'Task[0][date]', true, 'task-0-date', '#task-0-date'],
    ['task-0-due', 'Task[0][due]', true, 'task-0-due', null],
    ['task-0-start', 'Task[0][start]', true, 'task-0-start', null],
    ['task-1-date', 'Task[1][date]', true, 'task-1-date', '#task-1-date'],
    ['task-1-due', 'Task[1][due]', true, 'task-1-due', null],
    ['task-1-start', 'Task[1][start]', true, 'task-1-start', null],
    ['task-2-date', 'Task[2][date]', true, 'task-2-date', '#task-2-date'],
    ['task-2-due', 'Task[2][due]', true, 'task-2-due', null],
    ['task-2-start', 'Task[2][start]', true, 'task-2-start', null],
  ]);
  expect(await duplicateIds(page)).toEqual([]);

  // The renumbered clone keeps its dates; the blank clone fails its required date and the name rule.
  await expect(page.locator('#task-1-date')).toHaveValue('2026-01-05');
  await expect(page.locator('#task-1-due')).toHaveValue('2026-01-06');
  await expectSubmitBlocked(page, '#datepicker-form');
  await expect(page.locator('.field-task-2-date .help-block')).toHaveText('Date cannot be blank.');
  await expect(page.locator('.field-task-1-date .help-block')).toHaveText('');

  await pick(page, 'task-2-date', 7);
  await expect(page.locator('.field-task-2-date .help-block'), 'a picked date triggers the validation of the field').toHaveText('');
  await page.locator('#task-1-name').fill('c1');
  await page.locator('#task-2-name').fill('c2');

  const payload = await submitAndCapture(page, '#datepicker-form');

  expect(payload.post.Task).toEqual([
    { id: '1', name: 'n0', date: '2025-03-10', due: '2025-04-01', start: '2025-02-03' },
    { id: '', name: 'c1', date: '2026-01-05', due: '2026-01-06', start: '' },
    { id: '', name: 'c2', date: '2026-01-07', due: '', start: '' },
  ]);
  expect(payload.post.outside).toBe('2025-12-24');
});

test('remove buttons clear their own row once, and repeated cycles add no handler to existing rows or the document', async ({ page }) => {
  expectKnownDefect('rendered-datepicker-handlers');
  await openScenario(page, 'datepicker');

  /** Counts the click handlers of the remove button of every component of the form, in document order. */
  const removeHandlers = () =>
    page.evaluate(() =>
      Array.from(
        document.querySelectorAll('#datepicker-form .kv-date-remove'),
        (button) => (window.jQuery._data(button, 'events')?.click ?? []).length,
      ),
    );

  // Each shown calendar listens on the document: the two inline calendars of the stored rows.
  expect(await documentHandlers(page)).toBe(2);

  await page.locator('#datepicker-form .add-first').click();
  await expect(rows(page, 'tasks')).toHaveCount(3);

  for (let cycle = 0; cycle < 3; cycle++) {
    await page.locator('#datepicker-form .add-first').click();
    await rows(page, 'tasks').last().locator('.remove-item').click();
  }

  await expect(rows(page, 'tasks')).toHaveCount(3);
  expect(await removeHandlers(), 'stored rows, the clone and the control outside the rows').toEqual([1, 1, 1, 1]);
  expect(await documentHandlers(page), 'the inline calendars of the three rows; deleted rows release theirs').toBe(3);

  // Deleting the first row renumbers the second stored row to 0 and the clone to 1; each remove button keeps clearing
  // the input of its own row, not the one that now has its former id.
  await pick(page, 'task-2-date', 9);
  await rows(page, 'tasks').first().locator('.remove-item').click();
  await expect(rows(page, 'tasks')).toHaveCount(2);

  await rows(page, 'tasks').nth(0).locator('.kv-date-remove').click();
  await expect(page.locator('#task-0-date')).toHaveValue('');
  await expect(page.locator('#task-1-date'), 'only its own row').toHaveValue('2026-01-09');

  await rows(page, 'tasks').nth(1).locator('.kv-date-remove').click();
  await expect(page.locator('#task-1-date')).toHaveValue('');
  await expect(page.locator('.field-task-1-date .help-block'), 'clearing triggers the validation of the field').toHaveText(
    'Date cannot be blank.',
  );
  await expect(page.locator('#task-0-name'), 'the renumbered stored row').toHaveValue('n1');
  expect(await instanceCounts(page, 'zero-form'), 'independent form').toEqual({ instances: 0, inline: 0 });
  expect(await instanceCounts(page, 'nested-form'), 'independent form').toEqual({ instances: 1, inline: 0 });
});

test('a form without rendered rows initializes inserted DatePickers, also after deleting the last row and inserting again', async ({ page }) => {
  expectKnownDefect('rendered-datepicker-zero-rows');
  await openScenario(page, 'datepicker');
  await flagInstances(page);

  await expect(rows(page, 'lines')).toHaveCount(0);
  await page.locator('#zero-form .add-first').click();
  await pick(page, 'line-0-date', 1);
  await rows(page, 'lines').first().locator('.remove-item').click();
  await expect(rows(page, 'lines')).toHaveCount(0);
  await page.locator('#zero-form .add-first').click();
  await pick(page, 'line-0-date', 2);
  await page.locator('#zero-form .add-first').click();
  await page.locator('#zero-form .add-first').click();
  await page.locator('#zero-form .add-first').click();
  await expect(rows(page, 'lines'), 'limit 3').toHaveCount(3);
  await flagInstances(page);
  await rows(page, 'lines').nth(1).locator('.remove-item').click();

  expect(await datePickers(page, 'zero-form')).toEqual([
    { id: 'line-0-date', name: 'Line[0][date]', value: '2026-01-02', picker: 'line-0-date-kvdate', source: 'line-0-date-kvdate', selected: '2026-01-02', kept: true },
    { id: 'line-1-date', name: 'Line[1][date]', value: '', picker: 'line-1-date-kvdate', source: 'line-1-date-kvdate', selected: '', kept: true },
  ]);
  expect(await instanceCounts(page, 'datepicker-form'), 'the other form gains no instance').toEqual({ instances: 7, inline: 2 });

  await expectSubmitBlocked(page, '#zero-form');
  await expect(page.locator('.field-line-1-date .help-block')).toHaveText('Date cannot be blank.');
  await expect(page.locator('.field-line-0-date .help-block')).toHaveText('');
});

test('nested rows get DatePickers under their own names and keep their instances when outer or inner rows change', async ({ page }) => {
  expectKnownDefect('rendered-datepicker-nested');
  await openScenario(page, 'datepicker');

  const kept = async () => (await datePickers(page, 'nested-form')).map((picker) => [picker.id, picker.picker, picker.kept]);

  // Every step flags the live instances first, so the replacement of any of them fails at the step that caused it.
  await flagInstances(page);
  await page.locator('#nested-form .add-room').click();
  expect(await kept(), 'inner insertion').toEqual([
    ['room-0-0-date', 'room-0-0-date-kvdate', true],
    ['room-0-1-date', 'room-0-1-date-kvdate', false],
  ]);

  await pick(page, 'room-0-1-date', 11);
  await flagInstances(page);
  await page.locator('#nested-form .add-house').click();
  expect(await kept(), 'outer insertion').toEqual([
    ['room-0-0-date', 'room-0-0-date-kvdate', true],
    ['room-0-1-date', 'room-0-1-date-kvdate', true],
    ['room-1-0-date', 'room-1-0-date-kvdate', false],
  ]);

  await flagInstances(page);
  await page.locator('#nested-form .house').nth(1).locator('.add-room').click();
  await pick(page, 'room-1-1-date', 12);
  await flagInstances(page);
  await rows(page, 'rooms').first().locator('.remove-room').click();
  expect(await datePickers(page, 'nested-form'), 'inner deletion renumbers the remaining room').toEqual([
    { id: 'room-0-0-date', name: 'Room[0][0][date]', value: '2026-01-11', picker: 'room-0-0-date-kvdate', source: 'room-0-0-date-kvdate', selected: '2026-01-11', kept: true },
    { id: 'room-1-0-date', name: 'Room[1][0][date]', value: '', picker: 'room-1-0-date-kvdate', source: 'room-1-0-date-kvdate', selected: '', kept: true },
    { id: 'room-1-1-date', name: 'Room[1][1][date]', value: '2026-01-12', picker: 'room-1-1-date-kvdate', source: 'room-1-1-date-kvdate', selected: '2026-01-12', kept: true },
  ]);

  // Deleting the second house releases nothing the first house holds.
  await page.locator('#nested-form .house').nth(1).locator('.remove-house').click();
  await expect(page.locator('#nested-form .house')).toHaveCount(1);
  expect(await kept()).toEqual([['room-0-0-date', 'room-0-0-date-kvdate', true]]);
  expect(await duplicateIds(page)).toEqual([]);
});
