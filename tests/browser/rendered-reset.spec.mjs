// PHP-rendered form reset tests: the `reset` scenario renders stored rows with every kind of control a native form reset
// restores, plus a sibling form with its own widget. The reset buttons are real `<button type="reset">` elements, so
// the browser runs its own reset algorithm; nothing is reset by script.

import { expect, expectKnownDefect, test } from './support/fixtures.mjs';
import { expectSubmitBlocked, openScenario, submitAndCapture, validatorIds } from './support/rendered.mjs';

const rows = (page) => page.locator('#dynamic-form .container-items > .item');
const otherRows = (page) => page.locator('#other-form .items > .item');

/** Returns every control of each row of the selector, in document order, with its current state. */
const controlStates = (page, selector = '#dynamic-form .container-items > .item') =>
  page.locator(selector).evaluateAll((items) =>
    items.map((item) =>
      Array.from(item.querySelectorAll('input, select, textarea'), (control) => {
        const state = { tag: control.tagName.toLowerCase(), id: control.id || null, name: control.getAttribute('name') };

        if (control.type === 'checkbox' || control.type === 'radio') {
          state.value = control.value;
          state.checked = control.checked;
        } else if (control.tagName === 'SELECT') {
          state.value = control.multiple ? Array.from(control.selectedOptions, (option) => option.value) : control.value;
        } else {
          state.value = control.value;
        }

        if (control.disabled) {
          state.disabled = true;
        }

        return state;
      }),
    ),
  );

const controls = (index, values) => {
  const id = (attribute) => `controls-${index}-${attribute}`;
  const name = (attribute) => `Controls[${index}][${attribute}]`;

  return [
    { tag: 'input', id: id('id'), name: name('id'), value: values.id },
    { tag: 'input', id: id('name'), name: name('name'), value: values.name },
    { tag: 'textarea', id: id('notes'), name: name('notes'), value: values.notes },
    { tag: 'select', id: id('kind'), name: name('kind'), value: values.kind },
    { tag: 'select', id: id('size'), name: name('size'), value: values.size },
    { tag: 'input', id: null, name: name('tags'), value: '' },
    { tag: 'select', id: id('tags'), name: `${name('tags')}[]`, value: values.tags },
    { tag: 'input', id: null, name: name('flag'), value: 'no' },
    { tag: 'input', id: id('flag'), name: name('flag'), value: 'yes', checked: values.flag },
    { tag: 'input', id: null, name: name('level'), value: '' },
    { tag: 'input', id: null, name: name('level'), value: 'low', checked: values.level === 'low' },
    { tag: 'input', id: null, name: name('level'), value: 'high', checked: values.level === 'high' },
    { tag: 'input', id: id('locked'), name: name('locked'), value: values.locked, disabled: true },
  ];
};

const first = { id: '1', name: 'Saved', notes: 'Long text', kind: 'b', size: 'm', tags: ['a', 'c'], flag: true, level: 'high', locked: 'L' };
const second = { id: '2', name: 'Second', notes: 'Other text', kind: 'c', size: 's', tags: ['b'], flag: false, level: 'low', locked: 'M' };
// The size select has no empty option, so the browser selects its first option, as in a freshly rendered row.
const blank = { id: '', name: '', notes: '', kind: '', size: 's', tags: [], flag: false, level: null, locked: '' };

/** Changes every editable control of a row, so a reset that restores nothing is observable. */
async function edit(page, index, { name, notes, kind, size, tags, flag, level }) {
  await page.locator(`#controls-${index}-name`).fill(name);
  await page.locator(`#controls-${index}-notes`).fill(notes);
  await page.locator(`#controls-${index}-kind`).selectOption(kind);
  await page.locator(`#controls-${index}-size`).selectOption(size);
  await page.locator(`#controls-${index}-tags`).selectOption(tags);
  await page.locator(`#controls-${index}-flag`).setChecked(flag);
  await page.locator(`#dynamic-form input[name="Controls[${index}][level]"][value="${level}"]`).check();
}

const edited = { name: 'Edited', notes: 'Changed', kind: 'a', size: 's', tags: ['b', 'c'], flag: false, level: 'low' };
const typed = { name: 'Typed', notes: 'Typed notes', kind: 'c', size: 'm', tags: ['a'], flag: true, level: 'high' };

const reset = (page, formId = 'dynamic-form') => page.locator(`#${formId} button.reset`).click();

test('a native reset restores stored rows and leaves inserted rows blank', async ({ page }) => {
  expectKnownDefect('rendered-reset-rows');
  await openScenario(page, 'reset');

  expect(await controlStates(page), 'Rendered stored rows').toEqual([controls(0, first), controls(1, second)]);

  await edit(page, 0, edited);
  await rows(page).nth(1).locator('.add-item').click();
  await edit(page, 2, typed);
  await reset(page);

  await expect(rows(page)).toHaveCount(3);
  expect(await controlStates(page), 'Stored values restored, inserted row blank').toEqual([
    controls(0, first),
    controls(1, second),
    controls(2, blank),
  ]);
  expect(await validatorIds(page)).toEqual(['controls-0-name', 'controls-1-name', 'controls-2-name']);

  await edit(page, 2, typed);
  await reset(page);
  await rows(page).nth(2).locator('.add-item').click();
  await edit(page, 3, typed);
  await reset(page);

  await expect(rows(page)).toHaveCount(4);
  expect(await controlStates(page), 'Repeated resets and a later insertion').toEqual([
    controls(0, first),
    controls(1, second),
    controls(2, blank),
    controls(3, blank),
  ]);
  expect(await validatorIds(page)).toEqual(['controls-0-name', 'controls-1-name', 'controls-2-name', 'controls-3-name']);

  await expectSubmitBlocked(page);
  await expect(page.locator('.field-controls-2-name .help-block')).toHaveText('Name cannot be blank.');
  await page.locator('#controls-2-name').fill('Third');
  await page.locator('#controls-3-name').fill('Fourth');

  const payload = await submitAndCapture(page);
  const empty = { id: '', notes: '', kind: '', size: 's', tags: '', flag: 'no', level: '' };

  expect(payload.post.Controls, 'Disabled controls are not posted; sentinels are').toEqual([
    { id: '1', name: 'Saved', notes: 'Long text', kind: 'b', size: 'm', tags: ['a', 'c'], flag: 'yes', level: 'high' },
    { id: '2', name: 'Second', notes: 'Other text', kind: 'c', size: 's', tags: ['b'], flag: 'no', level: 'low' },
    { ...empty, name: 'Third' },
    { ...empty, name: 'Fourth' },
  ]);
});

test('a reset after deleting a stored row restores each remaining row to its own stored values', async ({ page }) => {
  expectKnownDefect('rendered-reset-reindexed');
  await openScenario(page, 'reset');

  await rows(page).nth(0).locator('.remove-item').click();
  await rows(page).nth(0).locator('.add-item').click();
  await edit(page, 0, edited);
  await edit(page, 1, typed);
  await reset(page);

  await expect(rows(page)).toHaveCount(2);
  expect(await controlStates(page), 'The renumbered stored row keeps its own values').toEqual([
    controls(0, second),
    controls(1, blank),
  ]);
  expect(await validatorIds(page)).toEqual(['controls-0-name', 'controls-1-name']);
});

test('resetting one form leaves the rows of another form untouched', async ({ page }) => {
  expectKnownDefect('rendered-reset-isolation');
  await openScenario(page, 'reset');

  const otherNames = () => otherRows(page).locator('input[type=text]').evaluateAll((inputs) => inputs.map((input) => `${input.id}=${input.value}`));

  await page.locator('#other-0-name').fill('Changed');
  await otherRows(page).nth(0).locator('.add-other').click();
  await page.locator('#other-1-name').fill('Added');
  await rows(page).nth(1).locator('.add-item').click();
  await edit(page, 2, typed);
  await reset(page);

  expect(await otherNames(), 'The sibling form keeps its edits').toEqual(['other-0-name=Changed', 'other-1-name=Added']);
  expect(await controlStates(page), 'Only the reset form is restored').toEqual([
    controls(0, first),
    controls(1, second),
    controls(2, blank),
  ]);

  await edit(page, 0, edited);
  await reset(page, 'other-form');

  await expect(otherRows(page)).toHaveCount(2);
  expect(await otherNames(), 'The sibling clone does not inherit its template value').toEqual(['other-0-name=Kept', 'other-1-name=']);
  await expect(page.locator('#controls-0-name'), 'The first form keeps its edits').toHaveValue('Edited');
  expect(await validatorIds(page, 'other-form')).toEqual(['other-0-name', 'other-1-name']);
});
