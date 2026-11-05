import { beforeAll, describe, expect, test } from 'vitest';

import { patternAttribute, requiredAttribute } from './fixtures/markup.js';
import { houses, inputs, nestedForm, roomsOf } from './fixtures/nested.js';
import { blankError, firstInsertButton, insertButton, options, removeButton, rows, tabularForm } from './fixtures/tabular.js';
import { defectTest } from './support/defect-test.js';
import { initialize, insert, mount, remove } from './support/dom.js';
import { loadEnvironment } from './support/environment.js';
import { validate, validatorIds } from './support/state.js';

/**
 * Client validation contracts: each row owns exactly one validator per validated field, rules really run on inserted
 * rows, deleted rows leave no validator and intentionally different per-row rules survive.
 */
beforeAll(loadEnvironment);

describe('row validators', () => {
  test('an inserted row gets its own validator and the required rule runs on it', async () => {
    mount(tabularForm());

    insert(options(), insertButton(0));

    expect(validatorIds('dynamic-form'), 'One validator per row.').toEqual(['formmodel-0-name', 'formmodel-1-name']);
    expect(await validate('dynamic-form'), 'Only the blank inserted row may fail.').toEqual({
      'formmodel-0-name': '',
      'formmodel-1-name': blankError,
    });
  });

  test('top insertion keeps one validator per row and validates the shifted rows', async () => {
    mount(tabularForm({ insertPosition: 'top' }));

    insert(options(), insertButton(0));

    expect(await validate('dynamic-form'), 'The new first row must fail, the saved row must pass.').toEqual({
      'formmodel-0-name': blankError,
      'formmodel-1-name': '',
    });
  });

  test('deleting a row removes its validator and revalidates the renumbered rows', async () => {
    mount(tabularForm({ rows: [{ name: '' }, { name: 'B' }] }));

    remove(options(), removeButton(0));

    expect(await validate('dynamic-form'), 'The remaining row is valid under its new index.').toEqual({
      'formmodel-0-name': '',
    });
  });

  defectTest('validation-last-row', 'deleting the last row removes its validator and insertion restores it', async () => {
    mount(tabularForm({ min: 0 }));

    remove(options(), removeButton(0));
    expect(validatorIds('dynamic-form'), 'Deleting the last row must remove its validator.').toEqual([]);

    insert(options(), firstInsertButton());
    expect(await validate('dynamic-form'), 'Re-inserted row must be validated again.').toEqual({
      'formmodel-0-name': blankError,
    });
  });

  defectTest('validation-without-activeform', 'a form without the ActiveForm client script still inserts and deletes rows', () => {
    const fixture = tabularForm({ rows: [{ name: 'A' }, { name: 'B' }] });

    fixture.validation = {};
    mount(fixture);
    insert(options(), insertButton(0));
    remove(options(), removeButton(0));

    expect(
      [Array.from(rows(), (row) => row.querySelector('[id$="-name"]').value), window.jQuery('#dynamic-form').data('yiiActiveForm')],
      'Rows must change and no ActiveForm data may be created.',
    ).toEqual([['B', ''], undefined]);
  });

  test('an attribute the application registered for a future row is replaced, not duplicated', async () => {
    const $ = window.jQuery;

    mount(tabularForm());
    $('#dynamic-form').yiiActiveForm('add', requiredAttribute('formmodel-1-name', '[1]name', blankError));

    insert(options(), insertButton(0));

    expect(
      $('#dynamic-form').data('yiiActiveForm').attributes.map((attribute) => attribute.id),
      'Each input must have exactly one validator.',
    ).toEqual(['formmodel-0-name', 'formmodel-1-name']);
    expect(await validate('dynamic-form'), 'The inserted row must be validated once.').toEqual({
      'formmodel-0-name': '',
      'formmodel-1-name': blankError,
    });
  });

  test('a form without client validation keeps no validators', async () => {
    mount(tabularForm({ validation: false, rows: [{ name: 'A' }, { name: 'B' }] }));

    insert(options(), insertButton(0));
    remove(options(), removeButton(1));

    expect([rows().length, validatorIds('dynamic-form')], 'Rows change without validators.').toEqual([2, []]);
  });
});

describe('template discovery', () => {
  test('rows inserted into an initially empty form are validated (zero start)', async () => {
    mount(tabularForm({ rows: [], template: {}, min: 0 }));

    insert(options(), firstInsertButton());
    insert(options(), firstInsertButton());

    expect(await validate('dynamic-form'), 'Both inserted rows must run the required rule.').toEqual({
      'formmodel-0-name': blankError,
      'formmodel-1-name': blankError,
    });
  });

  test('options without a fields list still clone the validators bound to the rendered inputs', async () => {
    const fixture = tabularForm();

    delete fixture.widgets.dynamicform_rows.fields;
    mount(fixture);

    insert(options(), insertButton(0));

    expect(await validate('dynamic-form'), 'The inserted row must run the rule of the rendered row.').toEqual({
      'formmodel-0-name': '',
      'formmodel-1-name': blankError,
    });
  });

  defectTest('validation-before-both-inits', 'a row inserted before both initializations is validated once ActiveForm initializes', async () => {
    const $ = window.jQuery;
    const fixture = tabularForm();
    const attributes = fixture.validation['dynamic-form'];

    delete fixture.validation;
    mount(fixture, { init: false });
    insert(options(), insertButton(0));
    initialize(fixture);
    $('#dynamic-form').yiiActiveForm(attributes, { scrollToError: false });
    document.querySelector('#formmodel-1-name').value = '';

    expect(await validate('dynamic-form'), 'The row must get its validator when ActiveForm initializes.').toEqual({
      'formmodel-0-name': '',
      'formmodel-1-name': blankError,
    });
  });

  test('a row inserted before the window-load initialization is validated', async () => {
    const fixture = tabularForm();

    mount(fixture, { init: false });
    insert(options(), insertButton(0));
    initialize(fixture);
    // Cleared explicitly so this case isolates validator attachment from the separate blank-clone contract.
    document.querySelector('#formmodel-1-name').value = '';

    expect(await validate('dynamic-form'), 'Row inserted before init must run the required rule.').toEqual({
      'formmodel-0-name': '',
      'formmodel-1-name': blankError,
    });
  });

  defectTest('validation-before-init-blank', 'a row inserted before the window-load initialization is blank', () => {
    const fixture = tabularForm();

    mount(fixture, { init: false });
    insert(options(), insertButton(0));
    initialize(fixture);

    expect(
      Array.from(rows(), (row) => row.querySelector('[id$="-name"]').value),
      'Row inserted before init must be blank.',
    ).toEqual(['Saved', '']);
  });

  defectTest('validation-per-row-rules', 'intentionally different per-row rules survive insertion', async () => {
    const fixture = tabularForm({ rows: [{ name: '' }, { name: 'x' }] });

    fixture.validation['dynamic-form'] = [
      requiredAttribute('formmodel-0-name', '[0]name', blankError),
      patternAttribute('formmodel-1-name', '[1]name', /^\d+$/, 'Name must be digits.'),
    ];
    mount(fixture);

    insert(options(), insertButton(1));

    expect(await validate('dynamic-form'), 'Each existing row must keep its own rule.').toEqual({
      'formmodel-0-name': blankError,
      'formmodel-1-name': 'Name must be digits.',
      'formmodel-2-name': '',
    });
  });
});

describe('nested validators', () => {
  defectTest('validation-nested', 'validators mirror the visible nested inputs after insertions and deletions', async () => {
    const fixture = nestedForm();
    const { dynamicform_houses: housesOptions, dynamicform_rooms: roomsOptions } = mount(fixture);

    insert(roomsOptions, houses()[0].querySelector('.add-room'));
    insert(housesOptions, document.querySelector('.add-house'));
    insert(roomsOptions, houses()[1].querySelector('.add-room'));
    remove(roomsOptions, roomsOf(0)[0].querySelector('.remove-room'));

    expect(validatorIds('nested-form'), 'No stale or duplicate validators.').toEqual(
      inputs().map((entry) => entry.split('|')[0]).sort(),
    );
    expect(await validate('nested-form'), 'Blank houses and rooms must fail with their own messages.').toEqual({
      'house-0-name': '',
      'house-1-name': 'House cannot be blank.',
      'room-0-0-name': 'Room cannot be blank.',
      'room-1-0-name': 'Room cannot be blank.',
      'room-1-1-name': 'Room cannot be blank.',
    });
  });
});
