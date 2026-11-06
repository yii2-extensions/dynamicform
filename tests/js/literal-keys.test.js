import { beforeAll, describe, expect, test } from 'vitest';

import {
  idOf,
  literalKeyForm,
  literalNestedForm,
  literalOptions,
  literalRows,
  nameError,
  nestedInputs,
} from './fixtures/literal-keys.js';
import { patternAttribute, requiredAttribute } from './fixtures/markup.js';
import { insertButton, options, tabularForm } from './fixtures/tabular.js';
import { initialize, insert, mount, remove } from './support/dom.js';
import { loadEnvironment } from './support/environment.js';
import { payload, rowIdentities, validate, validatorIds } from './support/state.js';

/**
 * Numeric literal keys around the row index (F-10): the `fields` the widget declares locate the row index, so only the
 * index changes on insertion, deletion and updates, while literal keys before it (`Model[2024]`) and after it
 * (`[7][code]`) stay in names, ids, labels, `.field-*` containers, validators and the submitted payload.
 */
beforeAll(loadEnvironment);

const identity = (index, name = '', code = '', { formName = 'Model[2024]', codeAttribute = 'code' } = {}) => {
  const prefix = idOf(formName);

  return [
    {
      id: `${prefix}-${index}-name`,
      name: `${formName}[${index}][name]`,
      value: name,
      label: 'Name',
      container: `field-${prefix}-${index}-name`,
    },
    {
      id: `${prefix}-${index}-7-${codeAttribute}`,
      name: `${formName}[${index}][7][${codeAttribute}]`,
      value: code,
      label: 'Code',
      container: `field-${prefix}-${index}-7-${codeAttribute}`,
    },
  ];
};

const posted = (index, id = '', name = '', code = '') => [
  [`Model[2024][${index}][id]`, id],
  [`Model[2024][${index}][name]`, name],
  [`Model[2024][${index}][7][code]`, code],
];

const hiddenIds = () => Array.from(document.querySelectorAll('#literal-form input[type=hidden]'), (input) => input.id);

const threeRows = [
  { id: '1', name: 'A', code: 'a' },
  { id: '2', name: 'B', code: 'b' },
  { id: '3', name: 'C', code: 'c' },
];

describe('rows with literal keys before and after the index', () => {
  test('inserting at the bottom renumbers only the row index', () => {
    mount(literalKeyForm());

    insert(literalOptions(), literalRows()[0].querySelector('.add-item'));

    expect(rowIdentities(literalRows()), 'Literal keys 2024 and 7 must survive in both rows.').toEqual([
      identity(0, 'Saved', 'A1'),
      identity(1),
    ]);
    expect(payload('literal-form'), 'The payload must keep the literal keys.').toEqual([
      ...posted(0, '1', 'Saved', 'A1'),
      ...posted(1),
    ]);
    expect(hiddenIds(), 'Undeclared attributes of the row model follow the same index.').toEqual([
      'model-2024-0-id',
      'model-2024-1-id',
    ]);
  });

  test('inserting at the top shifts the existing row and keeps its literal keys', () => {
    mount(literalKeyForm({ insertPosition: 'top' }));

    insert(literalOptions(), literalRows()[0].querySelector('.add-item'));

    expect(rowIdentities(literalRows()), 'The saved row must move to index 1.').toEqual([
      identity(0),
      identity(1, 'Saved', 'A1'),
    ]);
    expect(payload('literal-form'), 'The hidden key must move with its row.').toEqual([
      ...posted(0),
      ...posted(1, '1', 'Saved', 'A1'),
    ]);
  });

  test.each([
    { position: 'first', index: 0, kept: [threeRows[1], threeRows[2]] },
    { position: 'middle', index: 1, kept: [threeRows[0], threeRows[2]] },
  ])('deleting the $position row renumbers the remaining rows', ({ index, kept }) => {
    mount(literalKeyForm({ rows: threeRows }));

    remove(literalOptions(), literalRows()[index].querySelector('.remove-item'));

    expect(rowIdentities(literalRows()), 'Remaining rows must use consecutive indexes.').toEqual(
      kept.map((row, position) => identity(position, row.name, row.code)),
    );
    expect(payload('literal-form'), 'Values and keys must stay with their rows.').toEqual(
      kept.flatMap((row, position) => posted(position, row.id, row.name, row.code)),
    );
  });

  test('updateContainer renumbers reordered rows idempotently and moves their validators', async () => {
    const $ = window.jQuery;

    mount(literalKeyForm({ rows: [{ id: '1', name: 'A' }, { id: '2', name: '' }] }));
    literalRows()[0].parentNode.insertBefore(literalRows()[1], literalRows()[0]);

    $('#literal-form .dynamicform_literal').yiiDynamicForm('updateContainer');
    $('#literal-form .dynamicform_literal').yiiDynamicForm('updateContainer');

    expect(rowIdentities(literalRows()), 'Rows must be renumbered in their new order.').toEqual([
      identity(0),
      identity(1, 'A'),
    ]);
    expect(validatorIds('literal-form'), 'Repeated updates must not duplicate validators.').toEqual([
      'model-2024-0-name',
      'model-2024-1-name',
    ]);
    expect(await validate('literal-form'), 'Validators must follow the renumbered inputs.').toEqual({
      'model-2024-0-name': nameError,
      'model-2024-1-name': '',
    });
  });

  test('multi-digit indexes and digits in the model and attribute names keep the literal keys', async () => {
    const shape = { formName: 'Form2Model[2024]', codeAttribute: 'line2' };
    const values = Array.from({ length: 11 }, (_value, index) => ({ name: `N${index}`, code: `L${index}` }));

    mount(literalKeyForm({ rows: values, ...shape }));
    insert(literalOptions(), literalRows()[10].querySelector('.add-item'));

    expect(rowIdentities(literalRows()).slice(9), 'Indexes 10 and 11 must be renumbered like single digits.').toEqual([
      identity(9, 'N9', 'L9', shape),
      identity(10, 'N10', 'L10', shape),
      identity(11, '', '', shape),
    ]);

    const errors = await validate('literal-form');

    expect(
      [Object.keys(errors).length, errors['form2model-2024-10-name'], errors['form2model-2024-11-name']],
      'Every row must keep one validator.',
    ).toEqual([12, '', nameError]);
  });

  test('names the declared fields do not describe keep their previous renumbering', () => {
    const fixture = tabularForm();
    // Another model whose name contains the declared prefix, and a segment of the row model starting with a digit.
    const extra = (index) =>
      `<input type="text" id="subformmodel-${index}-note" name="SubFormModel[${index}][note]" value="s">` +
      `<input type="text" id="formmodel-2d-${index}-note" name="FormModel[2d][${index}][note]" value="d">`;
    const button = '<button type="button" class="add-item">';

    fixture.html = fixture.html.replace(button, `${extra(0)}${button}`);
    fixture.widgets.dynamicform_rows.template = fixture.widgets.dynamicform_rows.template.replace(button, `${extra(0)}${button}`);
    mount(fixture);
    insert(options(), insertButton(0));

    expect(
      Array.from(document.querySelectorAll('[name$="[note]"]'), (input) => `${input.id}|${input.name}|${input.value}`),
      'Only a value starting with a declared prefix followed by indexes may use the declared fields.',
    ).toEqual([
      'subformmodel-0-note|SubFormModel[0][note]|s',
      'formmodel-2d-0-note|FormModel[2d][0][note]|d',
      'subformmodel-1-note|SubFormModel[1][note]|',
      'formmodel-2d-1-note|FormModel[2d][1][note]|',
    ]);
  });
});

describe('validators of rows with literal keys', () => {
  test('an inserted row gets one validator under its own id and the rule runs on it', async () => {
    mount(literalKeyForm());

    insert(literalOptions(), literalRows()[0].querySelector('.add-item'));
    insert(literalOptions(), literalRows()[1].querySelector('.add-item'));
    remove(literalOptions(), literalRows()[1].querySelector('.remove-item'));

    expect(validatorIds('literal-form'), 'One validator per row, no stale or duplicate ids.').toEqual([
      'model-2024-0-name',
      'model-2024-1-name',
    ]);
    expect(await validate('literal-form'), 'Only the blank inserted row may fail.').toEqual({
      'model-2024-0-name': '',
      'model-2024-1-name': nameError,
    });
  });

  test('intentionally different per-row and per-field rules survive renumbering', async () => {
    const rules = (index) =>
      index === 0
        ? [
            requiredAttribute('model-2024-0-name', '[0]name', nameError),
            patternAttribute('model-2024-0-7-code', '[0][7]code', /^\d+$/, 'Code must be digits.'),
          ]
        : [
            patternAttribute(`model-2024-${index}-name`, `[${index}]name`, /^\d+$/, 'Name must be digits.'),
            requiredAttribute(`model-2024-${index}-7-code`, `[${index}][7]code`, 'Code cannot be blank.'),
          ];

    mount(literalKeyForm({ rows: [{ name: '', code: 'x' }, { name: 'x', code: 'y' }], rules }));
    insert(literalOptions(), literalRows()[0].querySelector('.add-item'));
    remove(literalOptions(), literalRows()[0].querySelector('.remove-item'));

    expect(await validate('literal-form'), 'The renumbered row keeps its rules; the new row takes the field templates.').toEqual({
      'model-2024-0-name': 'Name must be digits.',
      'model-2024-0-7-code': '',
      'model-2024-1-name': '',
      'model-2024-1-7-code': 'Code cannot be blank.',
    });
  });

  test('a zero-start form validates the first inserted row from the declared fields', async () => {
    mount(literalKeyForm({ rows: [], min: 0 }));

    insert(literalOptions(), document.querySelector('#literal-form .add-first'));

    expect(rowIdentities(literalRows()), 'The blank template row must take index 0.').toEqual([identity(0)]);
    expect(validatorIds('literal-form'), 'The removed row validator becomes the template.').toEqual(['model-2024-0-name']);
  });

  test('rows insert and delete without client validation', () => {
    mount(literalKeyForm({ validation: false }));

    insert(literalOptions(), literalRows()[0].querySelector('.add-item'));
    insert(literalOptions(), literalRows()[0].querySelector('.add-item'));
    remove(literalOptions(), literalRows()[1].querySelector('.remove-item'));

    expect(
      { rows: rowIdentities(literalRows()), validators: validatorIds('literal-form') },
      'Identities must stay coherent with no validator registered.',
    ).toEqual({ rows: [identity(0, 'Saved', 'A1'), identity(1)], validators: [] });
  });

  test('a sibling form with the same names, ids and container class is not changed', () => {
    mount(literalKeyForm({ sibling: true }));
    const before = { rows: rowIdentities(literalRows('sibling-form')), validators: validatorIds('sibling-form') };

    insert(literalOptions(), literalRows()[0].querySelector('.add-item'));
    remove(literalOptions(), literalRows()[0].querySelector('.remove-item'));

    expect(
      { rows: rowIdentities(literalRows('sibling-form')), validators: validatorIds('sibling-form') },
      'The sibling form must keep its rows and validators.',
    ).toEqual(before);
    expect(before.rows, 'The sibling form renders the same identities.').toEqual([identity(0, 'Other', 'Z9')]);
    expect(rowIdentities(literalRows()), 'The edited form keeps its literal keys.').toEqual([identity(0)]);
  });

  test('initializing twice keeps one validator per row', () => {
    const fixture = literalKeyForm();

    mount(fixture);
    initialize(fixture);
    insert(literalOptions(), literalRows()[0].querySelector('.add-item'));

    expect(validatorIds('literal-form'), 'No duplicate validators.').toEqual(['model-2024-0-name', 'model-2024-1-name']);
  });
});

describe('nested rows with literal keys', () => {
  test('inner rows renumber their index path and keep the literal keys of both levels', async () => {
    const fixture = literalNestedForm();
    const { dynamicform_literal_houses: housesOptions, dynamicform_literal_rooms: roomsOptions } = mount(fixture);
    const houses = () => document.querySelectorAll('#literal-nested-form .houses > .house');

    insert(roomsOptions, houses()[0].querySelector('.add-room'));
    insert(housesOptions, document.querySelector('.add-house'));
    insert(roomsOptions, houses()[1].querySelector('.add-room'));
    remove(roomsOptions, houses()[0].querySelector('.remove-room'));

    expect(nestedInputs(), 'Only the house and room indexes may change.').toEqual([
      'house-2024-0-name|House[2024][0][name]|h0',
      'room-2024-0-0-7-name|Room[2024][0][0][7][name]|',
      'house-2024-1-name|House[2024][1][name]|',
      'room-2024-1-0-7-name|Room[2024][1][0][7][name]|',
      'room-2024-1-1-7-name|Room[2024][1][1][7][name]|',
    ]);
    expect(
      Array.from(document.querySelectorAll('#literal-nested-form label'), (label) => label.getAttribute('for')),
      'Labels must follow their inputs.',
    ).toEqual(nestedInputs().map((entry) => entry.split('|')[0]));
    expect(validatorIds('literal-nested-form'), 'One validator per visible input.').toEqual(
      nestedInputs().map((entry) => entry.split('|')[0]).sort(),
    );
    expect(await validate('literal-nested-form'), 'Blank rows must fail with their own messages.').toEqual({
      'house-2024-0-name': '',
      'house-2024-1-name': 'House cannot be blank.',
      'room-2024-0-0-7-name': 'Room cannot be blank.',
      'room-2024-1-0-7-name': 'Room cannot be blank.',
      'room-2024-1-1-7-name': 'Room cannot be blank.',
    });
  });
});
