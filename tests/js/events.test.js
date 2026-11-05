import { beforeAll, describe, expect, test } from 'vitest';

import { houses, nestedForm, roomsOf } from './fixtures/nested.js';
import { insertButton, options, removeButton, rows, tabularForm } from './fixtures/tabular.js';
import { insert, mount, remove } from './support/dom.js';
import { loadEnvironment } from './support/environment.js';
import { validatorIds } from './support/state.js';

/**
 * Limit and event contracts: `min`/`limit` bounds, the arguments and order of afterInsert, beforeDelete, afterDelete
 * and limitReached, cancellation through beforeDelete and dispatch to the owning container only.
 */
beforeAll(loadEnvironment);

/** Records every plugin event triggered on the elements, with the row count at the time of the event. */
function recordEvents(elements, events = ['afterInsert', 'beforeDelete', 'afterDelete', 'limitReached']) {
  const $ = window.jQuery;
  const log = [];

  $(elements).each(function (owner) {
    for (const name of events) {
      $(this).on(name, (event, ...args) => {
        log.push({ owner, event: event.type, args, rows: rows().length });
      });
    }
  });

  return log;
}

describe('bounds', () => {
  test('deletion stops at min and insertion stops at limit with limitReached', () => {
    mount(tabularForm({ min: 1, limit: 2 }));
    const log = recordEvents(document.querySelector('.dynamicform_wrapper'));

    remove(options(), removeButton(0));
    expect(rows(), 'Minimum row must be kept.').toHaveLength(1);

    insert(options(), insertButton(0));
    insert(options(), insertButton(0));
    expect(rows(), 'Limit must stop the second insertion.').toHaveLength(2);

    expect(log, 'Only the insertion and the refused insertion must be reported.').toEqual([
      { owner: 0, event: 'afterInsert', args: [rows()[1]], rows: 2 },
      { owner: 0, event: 'limitReached', args: [2], rows: 2 },
    ]);
  });

  test('a zero minimum allows deleting the last row', () => {
    mount(tabularForm({ min: 0 }));

    remove(options(), removeButton(0));

    expect(rows(), 'Last row must be deleted.').toHaveLength(0);
  });
});

describe('deletion events', () => {
  test('beforeDelete receives the row before removal and afterDelete follows the renumbering', () => {
    mount(tabularForm({ rows: [{ name: 'A' }, { name: 'B' }] }));
    const target = rows()[0];
    const seen = [];

    window.jQuery('.dynamicform_wrapper')
      .on('beforeDelete', (_event, item) => seen.push(['beforeDelete', item === target, item.isConnected]))
      .on('afterDelete', () => seen.push(['afterDelete', document.querySelector('#formmodel-0-name').value]));

    remove(options(), removeButton(0));

    expect(seen, 'Events must bracket the removal in order.').toEqual([
      ['beforeDelete', true, true],
      ['afterDelete', 'B'],
    ]);
  });

  test('returning false from beforeDelete cancels the deletion without side effects', () => {
    mount(tabularForm({ rows: [{ name: 'A' }, { name: 'B' }] }));
    const log = recordEvents(document.querySelector('.dynamicform_wrapper'), ['afterDelete']);

    window.jQuery('.dynamicform_wrapper').on('beforeDelete', () => false);
    remove(options(), removeButton(0));

    expect(
      { rows: rows().length, first: document.querySelector('#formmodel-0-name').value, log, validators: validatorIds('dynamic-form') },
      'Cancelled deletion must keep rows, values and validators.',
    ).toEqual({ rows: 2, first: 'A', log: [], validators: ['formmodel-0-name', 'formmodel-1-name'] });
  });

  test('a beforeDelete handler that returns nothing does not cancel', () => {
    mount(tabularForm({ rows: [{ name: 'A' }, { name: 'B' }] }));

    window.jQuery('.dynamicform_wrapper').on('beforeDelete', () => undefined);
    remove(options(), removeButton(0));

    expect(rows(), 'Only `false` cancels.').toHaveLength(1);
  });
});

describe('event ownership', () => {
  test('nested insertions and deletions are reported only to the owning container', () => {
    const fixture = nestedForm();
    const { dynamicform_houses: housesOptions, dynamicform_rooms: roomsOptions } = mount(fixture);

    insert(housesOptions, document.querySelector('.add-house'));

    const log = recordEvents([
      document.querySelector('.dynamicform_outer'),
      ...document.querySelectorAll('.dynamicform_inner'),
    ], ['afterInsert', 'afterDelete']);

    insert(roomsOptions, houses()[1].querySelector('.add-room'));
    insert(roomsOptions, houses()[0].querySelector('.add-room'));
    remove(roomsOptions, roomsOf(0)[0].querySelector('.remove-room'));

    expect(
      log.map(({ owner, event }) => [owner, event]),
      'Owner indexes: 0 outer, 1 first inner, 2 second inner.',
    ).toEqual([
      [2, 'afterInsert'],
      [1, 'afterInsert'],
      [1, 'afterDelete'],
    ]);
    expect([roomsOf(0).length, roomsOf(1).length], 'Each house must keep its own rows.').toEqual([1, 2]);
  });
});
