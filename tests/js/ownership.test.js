import { beforeAll, describe, expect, test } from 'vitest';

import { namesIn, rootOutsideForm, tableRowsForm, twoFormsPage, twoRootsForm } from './fixtures/roots.js';
import { insert, mount, remove } from './support/dom.js';
import { loadEnvironment } from './support/environment.js';
import { validate, validatorIds } from './support/state.js';

/**
 * Ownership contracts: a widget renumbers, counts and validates only its own rows, also when other roots or forms on
 * the page use the same selectors, and rows may live inside a table body.
 */
beforeAll(loadEnvironment);

describe('several roots', () => {
  test('two roots in one form sharing item selectors do not renumber each other', () => {
    const { dynamicform_a: a } = mount(twoRootsForm());

    insert(a, document.querySelector('.add-a'));

    expect(
      { a: namesIn('.dynamicform_a'), b: namesIn('.dynamicform_b'), validators: validatorIds('roots-form') },
      'Only root A may change.',
    ).toEqual({
      a: ['a-0-name|A[0][name]|a0', 'a-1-name|A[1][name]|'],
      b: ['b-0-name|B[0][name]|b0', 'b-1-name|B[1][name]|b1'],
      validators: ['a-0-name', 'a-1-name', 'b-0-name', 'b-1-name'],
    });
  });

  test('a root does not take the validators of a sibling root whose model name ends with its own', async () => {
    const { dynamicform_a: items } = mount(twoRootsForm({ first: 'Item', second: 'LineItem' }));

    insert(items, document.querySelector('.add-a'));

    expect(await validate('roots-form'), 'The new item must run its own rule and the line items must keep theirs.').toEqual({
      'item-0-name': '',
      'item-1-name': 'Item cannot be blank.',
      'lineitem-0-name': '',
      'lineitem-1-name': '',
    });
  });

  test('independent forms keep their own rows and validators', () => {
    const { dynamicform_first: first, dynamicform_second: second } = mount(twoFormsPage());

    insert(first, document.querySelector('.add-a'));
    remove(second, document.querySelectorAll('.remove-add-b')[0]);

    expect(
      {
        a: namesIn('#form-a'),
        b: namesIn('#form-b'),
        validators: [validatorIds('form-a'), validatorIds('form-b')],
      },
      'Each form must change only through its own widget.',
    ).toEqual({
      a: ['a-0-name|A[0][name]|a0', 'a-1-name|A[1][name]|'],
      b: ['b-0-name|B[0][name]|b1'],
      validators: [['a-0-name', 'a-1-name'], ['b-0-name']],
    });
  });

  test('a container class reused in another form is renumbered separately', () => {
    const { dynamicform_first: first } = mount(twoFormsPage({ sameContainer: true }));

    insert(first, document.querySelector('.add-a'));

    expect(
      { a: namesIn('#form-a'), b: namesIn('#form-b') },
      'The other form must keep its indexes.',
    ).toEqual({
      a: ['a-0-name|A[0][name]|a0', 'a-1-name|A[1][name]|'],
      b: ['b-0-name|B[0][name]|b0', 'b-1-name|B[1][name]|b1'],
    });
  });
});

describe('form lookup', () => {
  test('validators of a form take the values of its own rows when another form renders the same ids', () => {
    const $ = window.jQuery;
    const { dynamicform_second: second } = mount(twoFormsPage({ sameModel: true }));

    insert(second, document.querySelector('.add-b'));

    expect(
      ['a-0-name', 'a-1-name', 'a-2-name'].map((id) => $('#form-b').yiiActiveForm('find', id).value),
      'Validator values must come from the inputs of form B.',
    ).toEqual(['b0', 'b1', '']);
    expect(validatorIds('form-a'), 'Form A must keep its own validator.').toEqual(['a-0-name']);
  });

  test('a root outside its form registers its validators in the form found by the configured id', () => {
    const fixture = rootOutsideForm();
    const { dynamicform_outside: outside } = mount(fixture);

    insert(outside, document.querySelector('.add-a'));

    expect(validatorIds(fixture.formId), 'Inserted row must be validated in the configured form.').toEqual([
      'a-0-name',
      'a-1-name',
    ]);
  });
});

describe('table rows', () => {
  test('rows inside a table body are inserted into the body and renumbered', () => {
    const { dynamicform_table: table } = mount(tableRowsForm());

    insert(table, document.querySelector('.add-item'));
    insert(table, document.querySelector('.add-item'));
    remove(table, document.querySelectorAll('.remove-item')[1]);

    expect(
      {
        rows: Array.from(document.querySelectorAll('table.container-produce > tbody > tr.produce-item'), (row) =>
          row.querySelector('input').name,
        ),
        values: namesIn('table'),
        validators: validatorIds('table-form'),
      },
      'Rows must stay in the table body with consecutive indexes.',
    ).toEqual({
      rows: ['Produce[0][name]', 'Produce[1][name]'],
      values: ['produce-0-name|Produce[0][name]|Corn', 'produce-1-name|Produce[1][name]|'],
      validators: ['produce-0-name', 'produce-1-name'],
    });
  });
});
