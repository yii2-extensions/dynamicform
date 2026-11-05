import { beforeAll, describe, expect, test } from 'vitest';

import { controlsForm } from './fixtures/controls.js';
import { enhanceSelect2, select2Form } from './fixtures/select2.js';
import { defectTest } from './support/defect-test.js';
import { insert, mount } from './support/dom.js';
import { loadEnvironment } from './support/environment.js';
import { payload, rowControls } from './support/state.js';

/**
 * Value contracts: cloned rows start blank while keeping control structure, option lists, checkbox/radio values and
 * unchecked sentinels; existing rows keep every value.
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

  defectTest('values-defaults', 'a form reset leaves the clone blank', () => {
    const fixture = controlsForm();

    mount(fixture);
    insert(fixture.widgets.dynamicform_controls, document.querySelector('.add-item'));
    document.querySelector('#controls-form').reset();

    expect(rowControls(document.querySelectorAll('.item')), 'Reset must restore saved values and a blank clone.').toEqual([
      controls(0, saved),
      controls(1, blank),
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
