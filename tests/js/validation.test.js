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

  test('initialization keeps the validators ActiveForm registered for the rendered rows', () => {
    const $ = window.jQuery;
    const fixture = tabularForm({ rows: [{ name: 'A' }, { name: 'B' }] });

    mount(fixture, { init: false });
    const before = [...$('#dynamic-form').data('yiiActiveForm').attributes];
    initialize(fixture);

    expect(
      $('#dynamic-form').data('yiiActiveForm').attributes.filter((attribute, index) => attribute !== before[index]),
      'No registration of a rendered row may be replaced.',
    ).toEqual([]);
  });

  test('initialization called on the container registers the rendered rows ActiveForm did not register', async () => {
    mount(tabularForm({ rows: [{ name: 'A' }, { name: '' }], registered: [0] }), { init: false });

    window.jQuery('.dynamicform_wrapper').yiiDynamicForm(options());

    expect(await validate('dynamic-form'), 'The second row must get the validator of the first and run it on its own input.').toEqual({
      'formmodel-0-name': '',
      'formmodel-1-name': blankError,
    });
  });

  test('a validated field inside the container but outside the rows keeps the validator ActiveForm registered', () => {
    const $ = window.jQuery;
    const fixture = tabularForm();

    fixture.html = fixture.html.replace(
      '<button type="button" class="add-item add-first">',
      `${field('order-total', 'Total', textInput('order-total', 'Order[total]'))}<button type="button" class="add-item add-first">`,
    );
    fixture.validation['dynamic-form'].push(requiredAttribute('order-total', 'total', 'Total cannot be blank.'));
    mount(fixture);
    const registration = $('#dynamic-form').yiiActiveForm('find', 'order-total');

    insert(options(), insertButton(0));
    remove(options(), removeButton(1));

    expect($('#dynamic-form').yiiActiveForm('find', 'order-total'), 'The field outside the rows is not a row field.').toBe(
      registration,
    );
  });

  test('an input inside the container but outside the rows with the id of a row field keeps its rule to itself', async () => {
    const $ = window.jQuery;
    const fixture = tabularForm();

    // Rendered above the rows, so ActiveForm registers it first.
    fixture.html = fixture.html.replace(
      '<div class="container-items">',
      `${field('formmodel-9-name', 'Outside', textInput('formmodel-9-name', 'FormModel[9][name]'))}<div class="container-items">`,
    );
    fixture.validation['dynamic-form'].unshift(requiredAttribute('formmodel-9-name', '[9]name', 'Outside cannot be blank.'));
    mount(fixture);
    const registration = $('#dynamic-form').yiiActiveForm('find', 'formmodel-9-name');

    insert(options(), insertButton(0));

    expect(
      { registration: $('#dynamic-form').yiiActiveForm('find', 'formmodel-9-name') === registration, errors: await validate('dynamic-form') },
      'The inserted row must run the row rule and the outside input keep its own registration.',
    ).toEqual({
      registration: true,
      errors: { 'formmodel-0-name': '', 'formmodel-1-name': blankError, 'formmodel-9-name': 'Outside cannot be blank.' },
    });
  });

  test('a validated input the application moves out of its row keeps its validator on updateContainer', async () => {
    const $ = window.jQuery;

    mount(tabularForm({ rows: [{ name: '' }, { name: 'B' }] }));
    $('.dynamicform_wrapper .add-first').before($('.field-formmodel-0-name'));

    $('.dynamicform_wrapper').yiiDynamicForm('updateContainer');

    expect(await validate('dynamic-form'), 'The moved input must still run its rule.').toEqual({
      'formmodel-0-name': blankError,
      'formmodel-1-name': '',
    });
  });

  // `ActiveField::$selectors` replaces Yii's `#<id>` and `.field-<id>`; an id holding a period needs escaped ones.
  // `selectors` gives the application selectors of an id, `expected` the registered ones after insertion.
  const escaped = (id) => [`#${id.replace('.', '\\.')}`, `.field-${id.replace('.', '\\.')}`];
  const attribute = (id) => [`[id="${id}"]`, `[class~="field-${id}"]`];
  test.each([
    ['backslash-escaped selectors follow', 'formmodel-{i}-name.x', escaped, escaped],
    ['attribute selectors follow', 'formmodel-{i}-name.x', attribute, attribute],
    [
      'selectors without the id become the defaults',
      'formmodel-{i}-name',
      () => ['[name="FormModel[0][name]"]', '.form-group'],
      (id) => [`#${id}`, `.field-${id}`],
    ],
  ])('application %s on insertion', async (_shape, pattern, selectors, expected) => {
    const id = (index) => pattern.replace('{i}', index);
    const row = (index, value) =>
      `<div class="item">${field(id(index), 'Name', textInput(id(index), `FormModel[${index}][name]`, value))}${buttons()}</div>`;
    const [input, container] = selectors(id(0));
    mount({
      html: `<form id="f"><div class="dynamicform_wrapper" data-dynamicform="w"><div class="items">${row(0, 'Saved')}</div></div></form>`,
      widgets: {
        w: widgetOptions({
          widgetContainer: 'dynamicform_wrapper',
          formId: 'f',
          fields: [{ id: pattern.replace('{i}', '{}'), name: 'FormModel[{}][name]' }],
          template: row(0, ''),
        }),
      },
      validation: { f: [{ ...requiredAttribute(id(0), '[0]name', blankError), input, container }] },
    });

    insert(window.w, document.querySelector('.add-item'));

    const registered = window.jQuery('#f').data('yiiActiveForm').attributes;
    expect(registered.map((attribute) => [attribute.id, attribute.input, attribute.container])).toEqual([
      [id(0), ...expected(id(0))],
      [id(1), ...expected(id(1))],
    ]);
    expect(await validate('f'), 'Both rows run their rule.').toEqual({ [id(0)]: '', [id(1)]: blankError });
  });

  test.each(['formmodel-{i}-name', 'formmodel-{i}-name.x'])(
    'compound selectors validate their own field after insertion and renumbering: %s',
    async (pattern) => {
      const $ = window.jQuery;
      const id = (index) => pattern.replace('{i}', index);
      const row = (index, value) =>
        `<div class="item">${field(id(index), 'Name', textInput(id(index), `FormModel[${index}][name]`, value))}${buttons()}</div>`;
      const input = `#${$.escapeSelector(id(0))}[name="FormModel[0][name]"]`;
      const container = `.field-${$.escapeSelector(id(0))}:has([name="FormModel[0][name]"])`;
      const fixture = {
        // The other form has the same ids; selector checks must stay inside the owning form.
        html: `<form id="other">${row(0, 'Other')}</form><form id="f"><div class="dynamicform_wrapper" data-dynamicform="w"><div class="items">${row(0, 'Saved')}</div></div></form>`,
        widgets: {
          w: widgetOptions({
            widgetContainer: 'dynamicform_wrapper',
            formId: 'f',
            fields: [{ id: pattern.replace('{i}', '{}'), name: 'FormModel[{}][name]' }],
            template: row(0, ''),
          }),
        },
        validation: { f: [{ ...requiredAttribute(id(0), '[0]name', blankError), input, container }] },
      };
      mount(fixture);
      const $form = $('#f');
      const $rows = () => $form.find('.items > .item');

      insert(window.w, $form.find('.add-item')[0]);

      const attributes = $form.data('yiiActiveForm').attributes;
      expect(attributes.map((attribute) => [attribute.input, attribute.container]), 'Keep valid selectors and fall back for stale names.').toEqual([
        [input, container],
        [`#${$.escapeSelector(id(1))}`, `.field-${$.escapeSelector(id(1))}`],
      ]);
      expect(await validate('f'), 'The inserted blank field must fail in its own form.').toEqual({ [id(0)]: '', [id(1)]: blankError });
      expect($('#other .help-block').text(), 'Another form with identical ids must remain untouched.').toBe('');

      $rows().first().find('input').val('');
      $rows().last().find('input').val('Second');
      $rows().first().appendTo($form.find('.items'));
      $form.find('.dynamicform_wrapper').yiiDynamicForm('updateContainer');

      expect(await validate('f'), 'Validation must follow the original field when its index changes.').toEqual({
        [id(0)]: '',
        [id(1)]: blankError,
      });

      remove(window.w, $rows().first().find('.remove-item')[0]);

      expect(await validate('f'), 'The remaining blank field must still fail after deletion renumbers it.').toEqual({
        [id(0)]: blankError,
      });
    },
  );

  test.each([
    ['matches another field', '[name="FormModel[0][name]"]', ':has([name="FormModel[0][name]"])'],
    ['also matches another field', '', ''],
  ])('rewritten selector that %s falls back to its own field', async (_shape, inputConstraint, containerConstraint) => {
    const $ = window.jQuery;
    const fixture = tabularForm();
    const attribute = fixture.validation['dynamic-form'][0];
    attribute.input += `${inputConstraint}, #formmodel-1-code`;
    attribute.container += `${containerConstraint}, .field-formmodel-1-code`;
    mount(fixture);

    insert(options(), insertButton(0));

    const $form = $('#dynamic-form');
    expect(
      $form.data('yiiActiveForm').attributes.map((attribute) => [attribute.input, attribute.container]),
      'A selector must resolve only to its own input and container.',
    ).toEqual([
      ['#formmodel-0-name', '.field-formmodel-0-name'],
      ['#formmodel-1-name', '.field-formmodel-1-name'],
    ]);
    expect(await validate('dynamic-form'), 'The inserted required field must fail.').toEqual({
      'formmodel-0-name': '',
      'formmodel-1-name': blankError,
    });

    $('#formmodel-1-name').val('Valid');

    expect(await validate('dynamic-form'), 'An unrelated blank field must not determine validation or receive the error.').toEqual({
      'formmodel-0-name': '',
      'formmodel-1-name': '',
    });
    expect($form.find('.field-formmodel-1-code .help-block').text()).toBe('');
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

  test('a zero-start form keeps apart the validators of fields whose id starts with the id of another', async () => {
    const id = (index, attribute) => `formmodel-${index}-${attribute}`;
    const input = (index, attribute, label) =>
      field(id(index, attribute), label, textInput(id(index, attribute), `FormModel[${index}][${attribute}]`));
    const row = (index) => `<div class="item">${input(index, 'name', 'Name')}${input(index, 'name_alias', 'Alias')}${buttons()}</div>`;
    const fixture = {
      html:
        '<form id="alias-form"><div class="dynamic_form" data-dynamicform="dynamicform_alias"><div class="items"></div>' +
        '<button type="button" class="add-item">Add</button></div></form>',
      widgets: {
        dynamicform_alias: widgetOptions({
          widgetContainer: 'dynamic_form',
          formId: 'alias-form',
          min: 0,
          fields: [
            { id: 'formmodel-{}-name', name: 'FormModel[{}][name]' },
            { id: 'formmodel-{}-name_alias', name: 'FormModel[{}][name_alias]' },
          ],
          template: row(0),
        }),
      },
      validation: {
        'alias-form': [
          requiredAttribute(id(0, 'name'), '[0]name', blankError),
          requiredAttribute(id(0, 'name_alias'), '[0]name_alias', 'Alias cannot be blank.'),
        ],
      },
    };

    mount(fixture);
    insert(fixture.widgets.dynamicform_alias, document.querySelector('.add-item'));
    insert(fixture.widgets.dynamicform_alias, document.querySelector('.add-item'));

    expect(await validate('alias-form'), 'Each field of each inserted row must run its own rule.').toEqual({
      [id(0, 'name')]: blankError,
      [id(0, 'name_alias')]: 'Alias cannot be blank.',
      [id(1, 'name')]: blankError,
      [id(1, 'name_alias')]: 'Alias cannot be blank.',
    });
  });

  test('an inner widget without rendered rows validates the rows inserted into a new outer row', async () => {
    const fixture = nestedForm({ rooms: [] });

    // The server registers the inner row it removed for `min` 0, as for the outer zero-start form.
    fixture.validation['nested-form'].push(requiredAttribute('room-0-0-name', '[0][0]name', 'Room cannot be blank.'));
    const { dynamicform_houses: housesOptions, dynamicform_rooms: roomsOptions } = mount(fixture);

    insert(housesOptions, document.querySelector('.add-house'));
    insert(roomsOptions, houses()[1].querySelector('.add-room'));
    insert(roomsOptions, houses()[1].querySelector('.add-room'));

    expect(await validate('nested-form'), 'The rooms of the new house must run the inner rule.').toEqual({
      'house-0-name': '',
      'house-1-name': 'House cannot be blank.',
      'room-1-0-name': 'Room cannot be blank.',
      'room-1-1-name': 'Room cannot be blank.',
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

describe('fields the widget does not declare', () => {
  const undeclared = (settings) => {
    const fixture = tabularForm(settings);

    delete fixture.widgets.dynamicform_rows.fields;
    return fixture;
  };

  test('rows past the tenth keep one validator each across a deletion', () => {
    mount(undeclared({ rows: Array.from({ length: 11 }, (_row, index) => ({ name: `Row ${index}` })) }));

    remove(options(), removeButton(0));

    expect(validatorIds('dynamic-form'), 'Every remaining row, and only those, must be validated.').toEqual(
      Array.from({ length: 10 }, (_row, index) => `formmodel-${index}-name`).sort(),
    );
  });

  test('a field of the row model inside the container but outside the rows keeps its own rule', async () => {
    const fixture = undeclared();

    // A tree model: the parent and its child rows render the same form name.
    fixture.html = fixture.html.replace(
      '<button type="button" class="add-item add-first">',
      `${field('formmodel-name', 'Parent', textInput('formmodel-name', 'FormModel[name]'))}<button type="button" class="add-item add-first">`,
    );
    fixture.validation['dynamic-form'].push(requiredAttribute('formmodel-name', 'name', 'Parent cannot be blank.'));
    mount(fixture);

    insert(options(), insertButton(0));

    expect(await validate('dynamic-form'), 'The row rule must not replace the rule of the parent field.').toEqual({
      'formmodel-0-name': '',
      'formmodel-1-name': blankError,
      'formmodel-name': 'Parent cannot be blank.',
    });
  });

  test.each([
    ['after both initializations', false],
    ['before both initializations', true],
  ])('a row inserted %s and removed by the application loses its validator on updateContainer', (_timing, early) => {
    const $ = window.jQuery;
    const fixture = undeclared();
    const attributes = fixture.validation['dynamic-form'];

    if (early) {
      delete fixture.validation;
    }
    mount(fixture, { init: !early });
    insert(options(), insertButton(0));
    if (early) {
      initialize(fixture);
      $('#dynamic-form').yiiActiveForm(attributes, { scrollToError: false });
    }
    rows()[1].remove();

    $('.dynamicform_wrapper').yiiDynamicForm('updateContainer');

    expect(validatorIds('dynamic-form'), 'Only the remaining row may keep a validator.').toEqual(['formmodel-0-name']);
  });
});

describe('nested validators', () => {
  test('a field of an outer row inside the inner widget but outside its rows follows its row', async () => {
    const fixture = nestedForm({ otherHouses: [['h1', ['r10']]] });
    const note = (index) => `house-${index}-note`;
    let index = 0;

    // The outer row field sits in the header of the inner widget, next to its rows.
    fixture.html = fixture.html.replace(/<div class="dynamicform_inner" data-dynamicform="dynamicform_rooms">/g, (container) => {
      const id = note(index++);
      return `${container}${field(id, 'Note', textInput(id, `House[${index - 1}][note]`, 'n'))}`;
    });
    fixture.validation['nested-form'].push(
      requiredAttribute(note(0), '[0]note', 'Note cannot be blank.'),
      requiredAttribute('room-1-0-name', '[1][0]name', 'Room cannot be blank.'),
      requiredAttribute('house-1-name', '[1]name', 'House cannot be blank.'),
      requiredAttribute(note(1), '[1]note', 'Note cannot be blank.'),
    );
    const { dynamicform_houses: housesOptions } = mount(fixture);

    remove(housesOptions, houses()[0].querySelector('.remove-house'));

    expect(validatorIds('nested-form'), 'The validators must follow the remaining house, renumbered.').toEqual(
      ['house-0-name', note(0), 'room-0-0-name'],
    );
  });

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
