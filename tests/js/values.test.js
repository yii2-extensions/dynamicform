import { beforeAll, describe, expect, test, vi } from 'vitest';

import { controlsForm, savedValues, secondValues } from './fixtures/controls.js';
import { buttons, select, widgetOptions } from './fixtures/markup.js';
import { houses, nestedForm } from './fixtures/nested.js';
import { namesIn, twoFormsPage } from './fixtures/roots.js';
import { enhanceSelect2, select2Form } from './fixtures/select2.js';
import { blankError, insertButton, options, rows, tabularForm } from './fixtures/tabular.js';
import { insert, mount, remove } from './support/dom.js';
import { loadEnvironment } from './support/environment.js';
import { payload, rowControls, rowIdentities, validate, validatorIds } from './support/state.js';

/**
 * Value contracts: cloned rows start blank while keeping control structure, option lists, checkbox/radio values and
 * unchecked sentinels; existing rows keep every value, and a native form reset restores both states.
 */
beforeAll(loadEnvironment);

const controls = (index, values) => [
  { tag: 'input', id: `formmodel-${index}-id`, name: `FormModel[${index}][id]`, type: 'hidden', value: values.id },
  { tag: 'input', id: `formmodel-${index}-name`, name: `FormModel[${index}][name]`, type: 'text', value: values.name },
  { tag: 'textarea', id: `formmodel-${index}-notes`, name: `FormModel[${index}][notes]`, type: 'textarea', value: values.notes },
  { tag: 'select', id: `formmodel-${index}-kind`, name: `FormModel[${index}][kind]`, value: values.kind },
  { tag: 'select', id: `formmodel-${index}-size`, name: `FormModel[${index}][size]`, value: values.size },
  { tag: 'input', id: null, name: `FormModel[${index}][tags]`, type: 'hidden', value: '' },
  { tag: 'select', id: `formmodel-${index}-tags`, name: `FormModel[${index}][tags][]`, value: values.tags },
  { tag: 'input', id: null, name: `FormModel[${index}][flag]`, type: 'hidden', value: 'no' },
  { tag: 'input', id: `formmodel-${index}-flag`, name: `FormModel[${index}][flag]`, type: 'checkbox', value: 'yes', checked: values.flag },
  { tag: 'input', id: null, name: `FormModel[${index}][level]`, type: 'hidden', value: '' },
  { tag: 'input', id: null, name: `FormModel[${index}][level]`, type: 'radio', value: 'low', checked: false },
  { tag: 'input', id: null, name: `FormModel[${index}][level]`, type: 'radio', value: 'high', checked: values.high },
  { tag: 'input', id: `formmodel-${index}-locked`, name: `FormModel[${index}][locked]`, type: 'text', value: values.locked, disabled: true },
];

const saved = { id: '1', name: 'Saved', notes: 'Long text', kind: 'b', size: 'm', tags: ['a', 'c'], flag: true, high: true, locked: 'L' };
// A single select without an empty option selects its first option once inserted (HTML selectedness algorithm),
// exactly as a freshly rendered row would.
const blank = { id: '', name: '', notes: '', kind: '', size: 's', tags: [], flag: false, high: false, locked: '' };

describe('cloned controls', () => {
  test('every control of the clone is blank and the original row keeps its values', () => {
    const fixture = controlsForm();

    mount(fixture);
    insert(fixture.widgets.dynamicform_controls, document.querySelector('.add-item'));

    expect(rowControls(document.querySelectorAll('.item')), 'Clone must be blank; sentinels and values kept.').toEqual([
      controls(0, saved),
      controls(1, blank),
    ]);
  });

  test('the submitted payload contains the original values and the blank clone', () => {
    const fixture = controlsForm();

    mount(fixture);
    insert(fixture.widgets.dynamicform_controls, document.querySelector('.add-item'));

    expect(payload('controls-form'), 'Disabled and unchecked controls must not be submitted.').toEqual([
      ['FormModel[0][id]', '1'],
      ['FormModel[0][name]', 'Saved'],
      ['FormModel[0][notes]', 'Long text'],
      ['FormModel[0][kind]', 'b'],
      ['FormModel[0][size]', 'm'],
      ['FormModel[0][tags]', ''],
      ['FormModel[0][tags][]', 'a'],
      ['FormModel[0][tags][]', 'c'],
      ['FormModel[0][flag]', 'no'],
      ['FormModel[0][flag]', 'yes'],
      ['FormModel[0][level]', ''],
      ['FormModel[0][level]', 'high'],
      ['FormModel[1][id]', ''],
      ['FormModel[1][name]', ''],
      ['FormModel[1][notes]', ''],
      ['FormModel[1][kind]', ''],
      ['FormModel[1][size]', 's'],
      ['FormModel[1][tags]', ''],
      ['FormModel[1][flag]', 'no'],
      ['FormModel[1][level]', ''],
    ]);
  });

  test('values typed into the original after initialization are not copied into later clones', () => {
    const fixture = controlsForm();

    mount(fixture);
    document.querySelector('#formmodel-0-name').value = 'Edited';
    insert(fixture.widgets.dynamicform_controls, document.querySelector('.add-item'));

    expect(
      [document.querySelector('#formmodel-0-name').value, document.querySelector('#formmodel-1-name').value],
      'Clone must come from the parsed template, not the live row.',
    ).toEqual(['Edited', '']);
  });
});

/** Changes every control of a row by script, including the disabled one, so a reset that restores nothing shows. */
const edit = (index, { name, notes, kind, size, tags, flag, high, locked }) => {
  const control = (attribute) => document.getElementById(`formmodel-${index}-${attribute}`);

  control('name').value = name;
  control('notes').value = notes;
  control('kind').value = kind;
  control('size').value = size;
  Array.from(control('tags').options).forEach((option) => {
    option.selected = tags.includes(option.value);
  });
  control('flag').checked = flag;
  document.querySelector(`input[name="FormModel[${index}][level]"][value="${high ? 'high' : 'low'}"]`).checked = true;
  control('locked').value = locked;
};

const edited = { name: 'Edited', notes: 'Changed', kind: 'a', size: 's', tags: ['b'], flag: false, high: false, locked: 'X' };
const typed = { name: 'Typed', notes: 'Typed notes', kind: 'c', size: 'm', tags: ['a'], flag: true, high: true, locked: 'Y' };
const second = { id: '2', name: 'Second', notes: 'Other text', kind: 'c', size: 's', tags: ['b'], flag: false, high: false, locked: 'M' };

// ActiveForm refreshes the state of its attributes on a timer after the reset event.
const reset = async (formId) => {
  document.getElementById(formId).reset();
  await new Promise((resolve) => setTimeout(resolve, 10));
};

const controlRows = () => rowControls(document.querySelectorAll('.item'));
const insertControls = (index) => insert(window.dynamicform_controls, document.querySelectorAll('.item')[index].querySelector('.add-item'));

describe('form reset', () => {
  test('a form reset leaves the clone blank', async () => {
    mount(controlsForm());
    insert(window.dynamicform_controls, document.querySelector('.add-item'));
    await reset('controls-form');

    expect(controlRows(), 'Reset must restore saved values and a blank clone.').toEqual([controls(0, saved), controls(1, blank)]);
  });

  test('editing stored rows and clones then resetting restores stored values, blank clones and their payload', async () => {
    mount(controlsForm({ rows: [savedValues, secondValues] }));
    insertControls(1);
    insertControls(2);
    edit(0, edited);
    edit(1, typed);
    edit(2, typed);
    edit(3, edited);
    await reset('controls-form');

    expect(controlRows(), 'Each stored row restores its own values; clones are blank.').toEqual([
      controls(0, saved),
      controls(1, second),
      controls(2, blank),
      controls(3, blank),
    ]);
    expect(payload('controls-form'), 'Clones submit only their sentinels and blank values.').toEqual([
      ['FormModel[0][id]', '1'],
      ['FormModel[0][name]', 'Saved'],
      ['FormModel[0][notes]', 'Long text'],
      ['FormModel[0][kind]', 'b'],
      ['FormModel[0][size]', 'm'],
      ['FormModel[0][tags]', ''],
      ['FormModel[0][tags][]', 'a'],
      ['FormModel[0][tags][]', 'c'],
      ['FormModel[0][flag]', 'no'],
      ['FormModel[0][flag]', 'yes'],
      ['FormModel[0][level]', ''],
      ['FormModel[0][level]', 'high'],
      ['FormModel[1][id]', '2'],
      ['FormModel[1][name]', 'Second'],
      ['FormModel[1][notes]', 'Other text'],
      ['FormModel[1][kind]', 'c'],
      ['FormModel[1][size]', 's'],
      ['FormModel[1][tags]', ''],
      ['FormModel[1][tags][]', 'b'],
      ['FormModel[1][flag]', 'no'],
      ['FormModel[1][level]', ''],
      ...[2, 3].flatMap((index) => [
        [`FormModel[${index}][id]`, ''],
        [`FormModel[${index}][name]`, ''],
        [`FormModel[${index}][notes]`, ''],
        [`FormModel[${index}][kind]`, ''],
        [`FormModel[${index}][size]`, 's'],
        [`FormModel[${index}][tags]`, ''],
        [`FormModel[${index}][flag]`, 'no'],
        [`FormModel[${index}][level]`, ''],
      ]),
    ]);
  });

  test('repeated resets and a later insertion keep the clones blank', async () => {
    mount(controlsForm());
    insertControls(0);
    edit(1, typed);
    await reset('controls-form');
    await reset('controls-form');
    insertControls(1);
    edit(0, edited);
    edit(2, typed);
    await reset('controls-form');

    expect(controlRows(), 'Clones inserted before and after a reset must stay blank.').toEqual([
      controls(0, saved),
      controls(1, blank),
      controls(2, blank),
    ]);
  });

  test('deleting a stored row before a reset keeps the defaults of the renumbered rows', async () => {
    mount(controlsForm({ rows: [savedValues, secondValues] }));
    insertControls(1);
    remove(window.dynamicform_controls, document.querySelectorAll('.item')[0].querySelector('.remove-item'));
    edit(0, edited);
    edit(1, typed);
    await reset('controls-form');

    expect(controlRows(), 'The renumbered stored row restores its own values.').toEqual([controls(0, second), controls(1, blank)]);
  });

  test('a reset does not change rows, names, ids or validators', async () => {
    mount(tabularForm());
    insert(options(), insertButton(0));
    document.getElementById('formmodel-0-name').value = 'Edited';
    document.getElementById('formmodel-1-name').value = 'Typed';
    document.getElementById('formmodel-1-code').value = 'B2';
    await reset('dynamic-form');

    const identity = (index, attribute, label, value) => ({
      id: `formmodel-${index}-${attribute}`,
      name: `FormModel[${index}][${attribute}]`,
      value,
      label,
      container: `field-formmodel-${index}-${attribute}`,
    });

    expect(rowIdentities(rows()), 'Only the values may be restored.').toEqual([
      [identity(0, 'name', 'Name', 'Saved'), identity(0, 'code', 'Code', 'A1')],
      [identity(1, 'name', 'Name', ''), identity(1, 'code', 'Code', '')],
    ]);
    expect(validatorIds('dynamic-form'), 'One validator per row.').toEqual(['formmodel-0-name', 'formmodel-1-name']);
    expect(await validate('dynamic-form'), 'The blank clone must fail validation.').toEqual({
      'formmodel-0-name': '',
      'formmodel-1-name': blankError,
    });

    insert(options(), insertButton(1));

    expect(validatorIds('dynamic-form'), 'A later insertion must be validated.').toEqual([
      'formmodel-0-name',
      'formmodel-1-name',
      'formmodel-2-name',
    ]);
  });

  test('resetting one form leaves the rows of another form untouched', async () => {
    const { dynamicform_first: formA, dynamicform_second: formB } = mount(twoFormsPage());

    insert(formA, document.querySelector('.add-a'));
    insert(formB, document.querySelector('.add-b'));
    document.getElementById('b-0-name').value = 'changed';
    document.getElementById('b-2-name').value = 'typed';
    document.getElementById('a-1-name').value = 'typed';
    await reset('form-a');

    expect([namesIn('#form-a'), namesIn('#form-b')], 'Only the reset form is restored.').toEqual([
      ['a-0-name|A[0][name]|a0', 'a-1-name|A[1][name]|'],
      ['b-0-name|B[0][name]|changed', 'b-1-name|B[1][name]|b1', 'b-2-name|B[2][name]|typed'],
    ]);

    await reset('form-b');

    expect(namesIn('#form-b'), 'The clone of the other form must not inherit its template value.').toEqual([
      'b-0-name|B[0][name]|b0',
      'b-1-name|B[1][name]|b1',
      'b-2-name|B[2][name]|',
    ]);
  });

  test('a reset leaves nested clones blank and restores the stored houses and rooms', async () => {
    const { dynamicform_houses: housesOptions, dynamicform_rooms: roomsOptions } = mount(nestedForm());

    insert(housesOptions, document.querySelector('.add-house'));
    insert(roomsOptions, houses()[1].querySelector('.add-room'));
    insert(roomsOptions, houses()[0].querySelector('.add-room'));
    document.querySelectorAll('#nested-form input').forEach((input) => {
      input.value = 'typed';
    });
    await reset('nested-form');

    expect(namesIn('#nested-form'), 'Stored values return; nested clones stay blank.').toEqual([
      'house-0-name|House[0][name]|h0',
      'room-0-0-name|Room[0][0][name]|r00',
      'room-0-1-name|Room[0][1][name]|',
      'house-1-name|House[1][name]|',
      'room-1-0-name|Room[1][0][name]|',
      'room-1-1-name|Room[1][1][name]|',
    ]);
  });
});

describe('Select2 controls', () => {
  test('a single Select2 clone is blank and enhanced once (issue #6)', () => {
    const fixture = select2Form();
    const $ = window.jQuery;

    mount(fixture);
    const calls = enhanceSelect2();
    insert(fixture.widgets.dynamicform_select2, document.querySelector('.add-item'));

    const [original, clone] = document.querySelectorAll('.item');

    expect(
      {
        original: $('#formmodel-0-kind').val(),
        clone: $('#formmodel-1-kind').val(),
        name: $('#formmodel-1-kind').attr('name'),
        containers: [original.querySelectorAll('.select2-container').length, clone.querySelectorAll('.select2-container').length],
        rendered: clone.querySelector('.select2-selection__rendered')?.textContent ?? null,
      },
      'Clone must be blank and enhanced once.',
    ).toEqual({ original: 'saved', clone: '', name: 'FormModel[1][kind]', containers: [1, 1], rendered: 'Choose' });
    expect(calls, 'Every enhanced select must be passed to the Kartik loading callback.').toEqual([
      ['initS2Loading', 'formmodel-0-kind'],
      ['initS2Loading', 'formmodel-1-kind'],
    ]);
  });

  test('a multiple Select2 clone is empty and the original keeps its selections', () => {
    const fixture = select2Form({ multiple: true });
    const $ = window.jQuery;

    mount(fixture);
    enhanceSelect2();
    insert(fixture.widgets.dynamicform_select2, document.querySelector('.add-item'));

    expect(
      {
        original: $('#formmodel-0-tags').val(),
        clone: $('#formmodel-1-tags').val(),
        name: $('#formmodel-1-tags').attr('name'),
        containers: document.querySelectorAll('.item')[1].querySelectorAll('.select2-container').length,
      },
      'Multiple clone must be empty and enhanced once.',
    ).toEqual({ original: ['a', 'b'], clone: [], name: 'FormModel[1][tags][]', containers: 1 });
  });
});

describe('TomSelect controls', () => {
  test('a cloned select marked with data-tomselect is enhanced once and the original is not re-enhanced', () => {
    const constructed = [];

    vi.stubGlobal(
      'TomSelect',
      class {
        constructor(select) {
          select.tomselect = this;
          constructed.push(select.id);
        }
      },
    );

    const row = (index) =>
      `<div class="item">${select(`formmodel-${index}-kind`, `FormModel[${index}][kind]`, { a: 'A', b: 'B' }, { attributes: ' data-tomselect' })}${buttons()}</div>`;
    const fixture = {
      html: `<form id="tom-form"><div class="dynamic_form" data-dynamicform="dynamicform_tom"><div class="items">${row(0)}</div></div></form>`,
      widgets: { dynamicform_tom: widgetOptions({ widgetContainer: 'dynamic_form', formId: 'tom-form', template: row(0) }) },
      validation: { 'tom-form': [] },
    };

    mount(fixture);
    new window.TomSelect(document.getElementById('formmodel-0-kind'));
    insert(fixture.widgets.dynamicform_tom, document.querySelector('.add-item'));

    expect(constructed, 'Only the clone may be enhanced by the plugin.').toEqual(['formmodel-0-kind', 'formmodel-1-kind']);
  });
});
