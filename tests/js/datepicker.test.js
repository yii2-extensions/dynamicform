import { beforeAll, describe, expect, test } from 'vitest';

import { datePickerForm, initRenderedDatePickers } from './fixtures/datepicker.js';
import { insert, mount, remove } from './support/dom.js';
import { loadDatePickerEnvironment } from './support/environment.js';

/**
 * Kartik DatePicker integration contracts with the real DatePicker 1.4.8 scripts (bootstrap-datepicker 1.8.0 as
 * `kvDatepicker`): each control of an inserted row gets one blank instance on the element DatePicker initializes, the
 * input for `TYPE_INPUT` and its container otherwise, and controls that already have an instance keep it. The
 * PHP-rendered browser tests cover the same integration in Chromium with the DatePicker widget.
 */
beforeAll(loadDatePickerEnvironment);

const options = () => window.dynamicform_dp;
const rows = () => document.querySelectorAll('.dynamic_form .items > .item');
const button = (index, kind) => rows()[index].querySelector(kind);
const instance = (id) => window.jQuery(document.getElementById(id)).data('datepicker');

/** Lists the ids of the elements holding a DatePicker instance, in document order. */
const instanceOwners = () =>
  Array.from(document.querySelectorAll('#dp-form *'))
    .filter((element) => window.jQuery(element).data('datepicker') !== undefined)
    .map((element) => element.id);

/** Counts the `mousedown` handlers on the document; bootstrap-datepicker binds one per shown (inline) calendar. */
const documentHandlers = () => (window.jQuery._data(document, 'events')?.mousedown ?? []).length;

function setup(fixtureOptions) {
  mount(datePickerForm(fixtureOptions));
  initRenderedDatePickers();
}

describe('DatePicker instances', () => {
  test('inserted rows get one blank instance per control; existing rows keep theirs', () => {
    setup();

    const original = instance('formmodel-0-due');

    insert(options(), button(0, '.add-item'));

    expect(rows()).toHaveLength(2);
    expect(instanceOwners(), 'the input of TYPE_INPUT, the container of the other types').toEqual([
      'formmodel-0-date-kvdate',
      'formmodel-0-due',
      'formmodel-0-start-kvdate',
      'formmodel-1-date-kvdate',
      'formmodel-1-due',
      'formmodel-1-start-kvdate',
    ]);
    expect(instance('formmodel-0-due'), 'original instance').toBe(original);
    expect(instance('formmodel-0-due').getFormattedDate()).toBe('2025-04-01');
    expect(
      ['formmodel-1-date-kvdate', 'formmodel-1-due', 'formmodel-1-start-kvdate'].map((id) => instance(id).getFormattedDate()),
      'the clone selects no date, the inline calendar included',
    ).toEqual(['', '', '']);
    expect(
      Array.from(rows()[1].querySelectorAll('[data-datepicker-source]'), (input) => input.getAttribute('data-datepicker-source')),
    ).toEqual(['formmodel-1-date-kvdate', 'formmodel-1-due', 'formmodel-1-start-kvdate']);
    expect(
      Array.from(rows(), (row) => window.jQuery._data(row.querySelector('.kv-date-remove'), 'events')?.click.length),
      'one handler per remove button',
    ).toEqual([1, 1]);

    instance('formmodel-1-due').setDate(new Date(2026, 0, 15));

    expect(document.getElementById('formmodel-1-due').value, 'the clone writes the format of its field').toBe('2026-01-15');
  });

  test('renumbered rows keep their instance, and deleting a row releases its inline calendar', () => {
    setup({
      dates: [
        ['2025-03-10', '2025-04-01', '2025-02-03'],
        ['2025-05-20', '2025-06-02', '2025-05-04'],
      ],
    });

    const kept = instance('formmodel-1-start-kvdate');
    // Calendars of earlier tests stay bound: emptying the document between tests destroys no instance.
    const handlers = documentHandlers();

    remove(options(), button(0, '.remove-item'));

    expect(instance('formmodel-0-start-kvdate'), 'renumbered instance').toBe(kept);
    expect(instance('formmodel-0-start-kvdate').getFormattedDate()).toBe('2025-05-04');
    expect(instanceOwners()).toEqual(['formmodel-0-date-kvdate', 'formmodel-0-due', 'formmodel-0-start-kvdate']);
    expect(documentHandlers(), 'the calendar of the deleted row is released').toBe(handlers - 1);
  });
});
