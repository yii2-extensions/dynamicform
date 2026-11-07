import { beforeAll, describe, expect, test } from 'vitest';

import {
  customIdForm,
  deletions,
  digitNamesForm,
  namedSegmentForm,
  numericLiteralForm,
} from './fixtures/identity.js';
import { houses, inputs, nestedForm, roomsOf } from './fixtures/nested.js';
import { blankError, insertButton, options, removeButton, rows, tabularForm } from './fixtures/tabular.js';
import { insert, mount, remove } from './support/dom.js';
import { loadEnvironment } from './support/environment.js';
import { rowIdentities, validate } from './support/state.js';

/**
 * Row identity contracts: ids, names, labels and `.field-*` containers are renumbered consistently on insertion and
 * deletion, for flat, nested, named-segment and custom-id rows.
 */
beforeAll(loadEnvironment);

const identity = (index, name, code) => [
  {
    id: `formmodel-${index}-name`,
    name: `FormModel[${index}][name]`,
    value: name,
    label: 'Name',
    container: `field-formmodel-${index}-name`,
  },
  {
    id: `formmodel-${index}-code`,
    name: `FormModel[${index}][code]`,
    value: code,
    label: 'Code',
    container: `field-formmodel-${index}-code`,
  },
];

describe('tabular rows', () => {
  test('inserting at the bottom appends a blank row with the next index', () => {
    mount(tabularForm());

    insert(options(), insertButton(0));

    expect(rowIdentities(rows()), 'Rows must be numbered in document order.').toEqual([
      identity(0, 'Saved', 'A1'),
      identity(1, '', ''),
    ]);
  });

  test('inserting at the top prepends a blank row and renumbers the existing one', () => {
    mount(tabularForm({ insertPosition: 'top' }));

    insert(options(), insertButton(0));

    expect(rowIdentities(rows()), 'Existing row must move to index 1.').toEqual([
      identity(0, '', ''),
      identity(1, 'Saved', 'A1'),
    ]);
  });

  test.each(deletions)('deleting the $position row renumbers the remaining rows', ({ index, names }) => {
    mount(
      tabularForm({
        rows: [
          { id: '1', name: 'A', code: 'a' },
          { id: '2', name: 'B', code: 'b' },
          { id: '3', name: 'C', code: 'c' },
        ],
      }),
    );

    remove(options(), removeButton(index));

    expect(rowIdentities(rows()), 'Remaining rows must keep values and use consecutive indexes.').toEqual(
      names.map((name, position) => identity(position, name, name.toLowerCase())),
    );
  });

  test('updateContainer renumbers idempotently from the container data attribute', () => {
    const $ = window.jQuery;

    mount(tabularForm({ rows: [{ name: 'A' }, { name: 'B' }] }));

    $('.dynamicform_wrapper').yiiDynamicForm('updateContainer');
    $('.dynamicform_wrapper').yiiDynamicForm('updateContainer');

    expect(rowIdentities(rows()), 'Repeated updates must not change identities.').toEqual([
      identity(0, 'A', ''),
      identity(1, 'B', ''),
    ]);
  });

  test('updateContainer renumbers rows reordered by the application and moves their validators', async () => {
    const $ = window.jQuery;

    mount(tabularForm({ rows: [{ name: 'A' }, { name: '' }] }));
    rows()[0].parentNode.insertBefore(rows()[1], rows()[0]);

    $('.dynamicform_wrapper').yiiDynamicForm('updateContainer');

    expect(rowIdentities(rows()), 'Rows must be renumbered in their new order.').toEqual([
      identity(0, '', ''),
      identity(1, 'A', ''),
    ]);
    expect(await validate('dynamic-form'), 'Validators must follow the renumbered inputs.').toEqual({
      'formmodel-0-name': blankError,
      'formmodel-1-name': '',
    });
  });

  test('rows with multi-digit indexes keep identities and validators', async () => {
    const values = Array.from({ length: 11 }, (_value, index) => ({ name: `N${index}` }));

    mount(tabularForm({ rows: values }));
    insert(options(), insertButton(10));

    expect(
      Array.from(rows(), (row) => row.querySelector('[id$="-name"]').getAttribute('name')).slice(9),
      'Indexes 10 and 11 must be renumbered like single digits.',
    ).toEqual(['FormModel[9][name]', 'FormModel[10][name]', 'FormModel[11][name]']);
    const errors = await validate('dynamic-form');

    expect(
      [Object.keys(errors).length, errors['formmodel-9-name'], errors['formmodel-10-name'], errors['formmodel-11-name']],
      'Every row must keep one validator.',
    ).toEqual([12, '', '', blankError]);
  });

  test('undeclared inputs with distinct prefix are renumbered by the regex fallback at any flat index', () => {
    const fixture = tabularForm({ rows: [{ name: 'initial' }] });
    const meta = (n) => `<input type="hidden" id="meta-${n}-ts" name="Meta[${n}][ts]">`;

    fixture.widgets.dynamicform_rows.template = fixture.widgets.dynamicform_rows.template.replace(
      '<button',
      `${meta(0)}<button`,
    );
    fixture.html = fixture.html.replace(
      '<button type="button" class="add-item">',
      `${meta(0)}<button type="button" class="add-item">`,
    );
    fixture.widgets.dynamicform_rows.limit = 15;

    mount(fixture);

    for (let i = 0; i < 11; i++) {
      insert(options(), insertButton(i));
    }
    remove(options(), removeButton(0));

    const meta10 = document.querySelector('#meta-10-ts');

    expect(
      meta10 ? `${meta10.id}|${meta10.getAttribute('name')}` : 'missing',
      'The undeclared hidden input from row 11 must renumber to index 10 after deleting row 0.',
    ).toBe('meta-10-ts|Meta[10][ts]');
  });

  test('controls with non-tabular names keep their names', () => {
    const fixture = tabularForm();

    fixture.widgets.dynamicform_rows.template = fixture.widgets.dynamicform_rows.template.replace(
      '<button',
      '<input type="search" name="filter" value=""><button',
    );
    fixture.html = fixture.html.replace('<button type="button" class="add-item">', '<input type="search" name="filter" value="x"><button type="button" class="add-item">');
    mount(fixture);
    insert(options(), insertButton(0));

    expect(
      Array.from(document.querySelectorAll('input[type=search]'), (input) => `${input.name}|${input.value}`),
      'Only tabular names may be renumbered.',
    ).toEqual(['filter|x', 'filter|']);
  });

  test('model and attribute names containing digits keep their digits', () => {
    const fixture = digitNamesForm();

    mount(fixture);
    insert(fixture.widgets.dynamicform_identity, document.querySelector('.add-item'));

    expect(rowIdentities(document.querySelectorAll('.item')), 'Only the row index may change.').toEqual([
      [{ id: 'form2model-0-line2', name: 'Form2Model[0][line2]', value: 'L2', label: 'Line 2', container: 'field-form2model-0-line2' }],
      [{ id: 'form2model-1-line2', name: 'Form2Model[1][line2]', value: '', label: 'Line 2', container: 'field-form2model-1-line2' }],
    ]);
  });
});

describe('special name and id shapes', () => {
  test('a named segment before the row index is preserved (issue #4)', () => {
    const fixture = namedSegmentForm();
    const id = (index) => `reporttemplategraphparameters-graph-wind-speed-correlation-${index}-y_id`;
    const name = (index) => `ReportTemplateGraphParameters[graph-wind-speed-correlation][${index}][y_id]`;

    mount(fixture);
    insert(fixture.widgets.dynamicform_identity, document.querySelector('.add-item'));

    expect(rowIdentities(document.querySelectorAll('.item')), 'Clone must keep the named segment.').toEqual([
      [{ id: id(0), name: name(0), value: '7', label: 'Y', container: `field-${id(0)}` }],
      [{ id: id(1), name: name(1), value: '', label: 'Y', container: `field-${id(1)}` }],
    ]);
  });

  test('a numeric literal key before the row index is preserved', () => {
    const fixture = numericLiteralForm();

    mount(fixture);
    insert(fixture.widgets.dynamicform_identity, document.querySelector('.add-item'));

    expect(
      Array.from(document.querySelectorAll('.item input'), (input) => `${input.id}|${input.name}|${input.value}`),
      'Literal key 2024 must survive; only the row index may change.',
    ).toEqual(['model-2024-0-x|Model[2024][0][x]|kept', 'model-2024-1-x|Model[2024][1][x]|']);
  });

  test('custom non-tabular ids stay unique and labelled across rows', () => {
    const fixture = customIdForm();

    mount(fixture);
    insert(fixture.widgets.dynamicform_identity, document.querySelectorAll('.add-item')[0]);
    insert(fixture.widgets.dynamicform_identity, document.querySelectorAll('.add-item')[0]);

    const ids = Array.from(document.querySelectorAll('.item input'), (input) => input.id);
    const labelled = Array.from(document.querySelectorAll('.item'), (row) => {
      const target = row.querySelector('label').getAttribute('for');

      return row.querySelector(`#${CSS.escape(target)}`) !== null;
    });

    expect(
      { unique: new Set(ids).size === ids.length, labelled },
      'Custom ids must be unique per row and labels must point inside their row.',
    ).toEqual({ unique: true, labelled: [true, true, true] });

    window.jQuery('.dynamic_form').yiiDynamicForm('updateContainer');

    expect(
      Array.from(document.querySelectorAll('.item input'), (input) => input.id),
      'Custom ids must be stable across updates.',
    ).toEqual(ids);
  });
});

describe('nested widgets', () => {
  test('a new outer row starts with one blank inner row when the template has several', () => {
    const { dynamicform_houses: housesOptions } = mount(nestedForm({ rooms: ['r00', 'r01'] }));

    insert(housesOptions, document.querySelector('.add-house'));

    expect(inputs(), 'The clone must keep only the first inner row.').toEqual([
      'house-0-name|House[0][name]',
      'room-0-0-name|Room[0][0][name]',
      'room-0-1-name|Room[0][1][name]',
      'house-1-name|House[1][name]',
      'room-1-0-name|Room[1][0][name]',
    ]);
  });

  test('an outer template without inner rows is cloned as is while other outer rows have several', () => {
    const { dynamicform_houses: housesOptions } = mount(nestedForm({ rooms: [], otherHouses: [['h1', ['r10', 'r11']]] }));

    insert(housesOptions, document.querySelector('.add-house'));

    expect(inputs(), 'The clone must keep the empty inner body of the template.').toEqual([
      'house-0-name|House[0][name]',
      'house-1-name|House[1][name]',
      'room-1-0-name|Room[1][0][name]',
      'room-1-1-name|Room[1][1][name]',
      'house-2-name|House[2][name]',
    ]);
  });

  test('inner rows are numbered within their outer row', () => {
    const fixture = nestedForm();
    const { dynamicform_houses: housesOptions, dynamicform_rooms: roomsOptions } = mount(fixture);

    insert(roomsOptions, houses()[0].querySelector('.add-room'));
    expect(inputs(), 'Room must be added to the first house.').toEqual([
      'house-0-name|House[0][name]',
      'room-0-0-name|Room[0][0][name]',
      'room-0-1-name|Room[0][1][name]',
    ]);

    insert(housesOptions, document.querySelector('.add-house'));
    expect(inputs(), 'New house must contain one blank room.').toEqual([
      'house-0-name|House[0][name]',
      'room-0-0-name|Room[0][0][name]',
      'room-0-1-name|Room[0][1][name]',
      'house-1-name|House[1][name]',
      'room-1-0-name|Room[1][0][name]',
    ]);

    insert(roomsOptions, houses()[1].querySelector('.add-room'));
    remove(roomsOptions, roomsOf(0)[0].querySelector('.remove-room'));
    expect(inputs(), 'Deleting a room must renumber only its house.').toEqual([
      'house-0-name|House[0][name]',
      'room-0-0-name|Room[0][0][name]',
      'house-1-name|House[1][name]',
      'room-1-0-name|Room[1][0][name]',
      'room-1-1-name|Room[1][1][name]',
    ]);
    expect(
      Array.from(document.querySelectorAll('#nested-form input'), (input) => input.value),
      'Values must stay with their rows.',
    ).toEqual(['h0', '', '', '', '']);
  });

  test('undeclared inputs with distinct prefix are renumbered by the regex fallback at any nested index', () => {
    const fixture = nestedForm({ rooms: ['r00'] });
    const seq = (h, r) =>
      `<input type="hidden" id="seq-${h}-${r}-ts" name="Seq[${h}][${r}][ts]">`;

    fixture.widgets.dynamicform_rooms.template = fixture.widgets.dynamicform_rooms.template.replace(
      '<button type="button" class="remove-room">',
      `${seq(0, 0)}<button type="button" class="remove-room">`,
    );
    fixture.html = fixture.html.replace(
      '<button type="button" class="remove-room">',
      `${seq(0, 0)}<button type="button" class="remove-room">`,
    );
    fixture.widgets.dynamicform_rooms.limit = 15;

    const { dynamicform_rooms: roomsOptions } = mount(fixture);

    for (let i = 0; i < 10; i++) {
      insert(roomsOptions, houses()[0].querySelector('.add-room'));
    }

    remove(roomsOptions, roomsOf(0)[0].querySelector('.remove-room'));

    const seq9 = roomsOf(0)[9]?.querySelector('[id$="-ts"]');

    expect(
      seq9 ? `${seq9.id}|${seq9.getAttribute('name')}` : 'missing',
      'The undeclared hidden input from inner row 10 must renumber to index 9 after deleting row 0.',
    ).toBe('seq-0-9-ts|Seq[0][9][ts]');
  });
});
