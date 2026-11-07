import { beforeAll, describe, expect, test } from 'vitest';

import { buttons, field, patternAttribute, radioList, requiredAttribute, textInput, widgetOptions } from './fixtures/markup.js';
import { houses, inputs, nestedForm, roomsOf } from './fixtures/nested.js';
import { blankError, firstInsertButton, insertButton, options, removeButton, rows, tabularForm } from './fixtures/tabular.js';
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

  test('deleting the last row removes its validator and insertion restores it', async () => {
    mount(tabularForm({ min: 0 }));

    remove(options(), removeButton(0));
    expect(validatorIds('dynamic-form'), 'Deleting the last row must remove its validator.').toEqual([]);

    insert(options(), firstInsertButton());
    expect(await validate('dynamic-form'), 'Re-inserted row must be validated again.').toEqual({
      'formmodel-0-name': blankError,
    });
  });

  test('a form without the ActiveForm client script still inserts and deletes rows', () => {
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

  test('radio list groups keep their validator across insertions and the clone gets its own', async () => {
    const level = (index) => `formmodel-${index}-level`;
    const row = (index, selected) =>
      `<div class="item">${field(level(index), 'Level', radioList(level(index), `FormModel[${index}][level]`, { low: 'Low', high: 'High' }, selected))}${buttons()}</div>`;
    const fixture = {
      html: `<form id="group-form"><div class="dynamic_form" data-dynamicform="dynamicform_group"><div class="items">${row(0, 'high')}</div></div></form>`,
      widgets: { dynamicform_group: widgetOptions({ widgetContainer: 'dynamic_form', formId: 'group-form', template: row(0, 'high') }) },
      validation: { 'group-form': [requiredAttribute(level(0), '[0]level', 'Level cannot be blank.')] },
    };

    mount(fixture);
    insert(fixture.widgets.dynamicform_group, document.querySelector('.add-item'));

    expect(validatorIds('group-form'), 'The group of each row must be registered.').toEqual([level(0), level(1)]);
    expect(await validate('group-form'), 'Only the blank clone may fail.').toEqual({
      [level(0)]: '',
      [level(1)]: 'Level cannot be blank.',
    });

    remove(fixture.widgets.dynamicform_group, document.querySelectorAll('.remove-item')[1]);

    expect(validatorIds('group-form'), 'The surviving group must keep its validator.').toEqual([level(0)]);
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

  test('validators of a zero-start form start from the blank value of each inserted row', () => {
    const $ = window.jQuery;

    mount(tabularForm({ rows: [], template: {}, min: 0 }));

    insert(options(), firstInsertButton());

    expect(
      $('#dynamic-form').data('yiiActiveForm').attributes.map(({ id, value }) => [id, value]),
      'The validator of the removed server row must be replaced by one that tracks the inserted input.',
    ).toEqual([['formmodel-0-name', '']]);
  });

  test('an inner widget without rendered rows validates rows inserted into a new outer row', async () => {
    const fixture = nestedForm({ rooms: [] });

    // The server registers the inner row it removed for `min` 0, as for the outer zero-start form.
    fixture.validation['nested-form'].push(requiredAttribute('room-0-0-name', '[0][0]name', 'Room cannot be blank.'));
    const { dynamicform_houses: housesOptions, dynamicform_rooms: roomsOptions } = mount(fixture);

    insert(housesOptions, document.querySelector('.add-house'));
    insert(roomsOptions, houses()[1].querySelector('.add-room'));

    expect(await validate('nested-form'), 'The room of the new house must run the inner rule.').toEqual({
      'house-0-name': '',
      'house-1-name': 'House cannot be blank.',
      'room-1-0-name': 'Room cannot be blank.',
    });
  });

  test('a validated field outside the widget keeps its validator across insertions and deletions', async () => {
    const fixture = tabularForm();

    fixture.html = fixture.html.replace(
      '</form>',
      `${field('order-customer', 'Customer', textInput('order-customer', 'Order[customer]'))}</form>`,
    );
    fixture.validation['dynamic-form'].push(requiredAttribute('order-customer', 'customer', 'Customer cannot be blank.'));
    mount(fixture);

    insert(options(), insertButton(0));
    remove(options(), removeButton(1));

    expect(await validate('dynamic-form'), 'The field outside the rows must still be validated.').toEqual({
      'formmodel-0-name': '',
      'order-customer': 'Customer cannot be blank.',
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

  test('a row inserted before both initializations is validated once ActiveForm initializes', async () => {
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

  test('a row inserted before the window-load initialization is blank', () => {
    const fixture = tabularForm();

    mount(fixture, { init: false });
    insert(options(), insertButton(0));
    initialize(fixture);

    expect(
      Array.from(rows(), (row) => row.querySelector('[id$="-name"]').value),
      'Row inserted before init must be blank.',
    ).toEqual(['Saved', '']);
  });

  test('array attributes with literal numeric segments keep their own rules on inserted rows', async () => {
    const rate = (index, slot) => `formmodel-${index}-rates-${slot}-amount`;
    const row = (index) =>
      `<div class="item">${field(rate(index, 1), 'Rate 1', textInput(rate(index, 1), `FormModel[${index}][rates][1][amount]`))}${field(rate(index, 2), 'Rate 2', textInput(rate(index, 2), `FormModel[${index}][rates][2][amount]`))}${buttons()}</div>`;
    const fixture = {
      html: `<form id="rates-form"><div class="dynamic_form" data-dynamicform="dynamicform_rates"><div class="items">${row(0)}</div></div></form>`,
      widgets: { dynamicform_rates: widgetOptions({ widgetContainer: 'dynamic_form', formId: 'rates-form', template: row(0) }) },
      validation: {
        'rates-form': [
          requiredAttribute(rate(0, 1), '[0]rates[1][amount]', 'Rate 1 cannot be blank.'),
          patternAttribute(rate(0, 2), '[0]rates[2][amount]', /^\d+$/, 'Rate 2 must be digits.'),
        ],
      },
    };

    mount(fixture);
    insert(fixture.widgets.dynamicform_rates, document.querySelector('.add-item'));
    document.getElementById(rate(1, 2)).value = 'x';

    expect(await validate('rates-form'), 'Each slot must keep its own rule in the inserted row.').toEqual({
      [rate(0, 1)]: 'Rate 1 cannot be blank.',
      [rate(0, 2)]: '',
      [rate(1, 1)]: 'Rate 1 cannot be blank.',
      [rate(1, 2)]: 'Rate 2 must be digits.',
    });
  });

  test('intentionally different per-row rules survive insertion', async () => {
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
  test('validators mirror the visible nested inputs after insertions and deletions', async () => {
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
