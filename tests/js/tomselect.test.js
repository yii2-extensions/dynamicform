import { beforeAll, describe, expect, test, vi } from 'vitest';

import { enhanceTomSelect, tomSelectForm } from './fixtures/tomselect.js';
import { insert, mount, remove } from './support/dom.js';
import { loadTomSelectEnvironment } from './support/environment.js';

/**
 * TomSelect integration contracts with the real TomSelect 2.4.3 complete build: the elements TomSelect generates in a
 * row (`.item` for each selected value, its wrapper, control and listbox) never count as rows, every instance refers to
 * its own row after renumbering, and the instance of a deleted row is released. The PHP-rendered browser tests cover
 * the same integration in Chromium with the page's own initialization.
 */
beforeAll(loadTomSelectEnvironment);

const options = () => window.dynamicform_ts;
const rows = () => document.querySelectorAll('.dynamic_form .items > .item, .dynamic_form .items > tbody > .item');
const button = (index, kind) => rows()[index].querySelector(kind);

function setup(fixtureOptions, enhanceOptions) {
  mount(tomSelectForm(fixtureOptions));
  enhanceTomSelect(enhanceOptions);
}

/** Lists every reference of a TomSelect instance that does not point at an element of its own row. */
function identityIssues(select) {
  const ts = select.tomselect;
  const row = select.closest('.item');
  const label = row.querySelector(`label[for="${ts.focus_node.id}"]`);
  const issues = [];
  const check = (what, actual, expected) => actual !== expected && issues.push(`${select.id} ${what}: ${actual} != ${expected}`);

  ts.refreshOptions(false);
  check('control id', ts.focus_node.id, `${select.id}-ts-control`);
  check('aria-controls', ts.focus_node.getAttribute('aria-controls'), `${select.id}-ts-dropdown`);
  check('dropdown id', ts.dropdown_content.id, `${select.id}-ts-dropdown`);
  check('label id', label?.id, `${select.id}-ts-label`);
  check('aria-labelledby', ts.focus_node.getAttribute('aria-labelledby'), label?.id);
  ts.dropdown_content.querySelectorAll('.option').forEach((option) => check('option id', option.id.startsWith(`${select.id}-opt-`), true));

  return issues;
}

const duplicateIds = () => {
  const ids = Array.from(document.querySelectorAll('[id]'), (element) => element.id);

  return ids.filter((id, index) => ids.indexOf(id) !== index);
};

describe('TomSelect row ownership', () => {
  test('rows holding selected TomSelect items are counted once against the limit', () => {
    const reached = [];

    setup({ rows: [{ kind: 'k1', tags: ['t1', 't3'] }, { kind: 'k2', tags: ['t2'] }], limit: 3 });
    window.jQuery('.dynamic_form').on('limitReached', (_event, limit) => reached.push(limit));

    insert(options(), button(0, '.add-item'));
    insert(options(), button(0, '.add-item'));

    expect(rows()).toHaveLength(3);
    expect(reached, 'limit reached by the second insertion only').toEqual([3]);
    expect(Array.from(rows(), (row) => row.querySelector('select').id)).toEqual(['formmodel-0-kind', 'formmodel-1-kind', 'formmodel-2-kind']);
    expect(Array.from(rows(), (row) => row.querySelector('select').name)).toEqual(['FormModel[0][kind]', 'FormModel[1][kind]', 'FormModel[2][kind]']);
  });

  test('the minimum counts rows, not the TomSelect items of the remaining row', () => {
    setup({ rows: [{ kind: 'k1', tags: ['t1', 't2'] }] });

    remove(options(), button(0, '.remove-item'));

    expect(rows()).toHaveLength(1);
    expect(document.getElementById('formmodel-0-kind').tomselect.getValue()).toBe('k1');
  });

  test('table rows in a tbody keep consecutive indexes next to selected TomSelect items', () => {
    setup({ rows: [{ kind: 'k2', tags: ['t3'] }], table: true });

    insert(options(), button(0, '.add-item'));
    insert(options(), button(0, '.add-item'));
    remove(options(), button(1, '.remove-item'));
    insert(options(), button(0, '.add-item'));

    expect(Array.from(rows(), (row) => row.tagName)).toEqual(['TR', 'TR', 'TR']);
    expect(Array.from(rows(), (row) => Array.from(row.querySelectorAll('select'), (select) => select.name))).toEqual(
      [0, 1, 2].map((i) => [`FormModel[${i}][kind]`, `FormModel[${i}][tags][]`, `FormModel[${i}][color]`]),
    );
    expect(Array.from(rows(), (row) => row.querySelector('select').tomselect.getValue())).toEqual(['k2', '', '']);
  });
});

describe('TomSelect instances', () => {
  test('a clone of the PHP template gets one instance with the plugin settings; originals keep theirs', () => {
    setup();

    const original = document.getElementById('formmodel-0-tags').tomselect;

    insert(options(), button(0, '.add-item'));
    insert(options(), button(1, '.add-item'));

    const instance = (id) => document.getElementById(id).tomselect;

    // The empty option the plugin settings allow is an `.item` of each clone; it is not a row either.
    expect(Array.from(rows(), (row) => row.querySelector('select').id)).toEqual(['formmodel-0-kind', 'formmodel-1-kind', 'formmodel-2-kind']);
    expect(options().template.find('.tomselected, .ts-wrapper')).toHaveLength(0);
    expect(instance('formmodel-0-tags'), 'original instance').toBe(original);
    expect([...instance('formmodel-0-tags').plugins.names], 'original settings').toEqual(['remove_button']);
    expect(instance('formmodel-0-tags').settings.maxItems).toBe(3);

    for (const index of [1, 2]) {
      const kind = instance(`formmodel-${index}-kind`);
      const tags = instance(`formmodel-${index}-tags`);

      expect([...kind.plugins.names].sort(), 'fixed settings of inserted rows').toEqual(['dropdown_input', 'remove_button']);
      expect([kind.getValue(), tags.getValue()], 'clone values').toEqual(['', []]);
      expect(kind.items, 'the empty prompt option is shown as the selected item').toEqual(['']);
      expect(Object.values(tags.optgroups).map((group) => group.label), 'option groups of the markup').toEqual(['Warm', 'Cold']);
      expect(instance(`formmodel-${index}-color`), 'plain select').toBeUndefined();
      expect(rows()[index].querySelectorAll('.ts-wrapper'), 'one wrapper per marked select').toHaveLength(2);
    }

    expect(instance('outside'), 'a marked select outside the rows').toBeUndefined();
  });

  test('without the TomSelect script, marked selects of inserted rows stay plain', () => {
    setup({ rows: [{ kind: 'k1' }] });
    vi.stubGlobal('TomSelect', undefined);

    insert(options(), button(0, '.add-item'));

    expect(rows()).toHaveLength(2);
    expect(rows()[1].querySelector('select').tomselect).toBeUndefined();
    expect(rows()[1].querySelectorAll('.ts-wrapper')).toHaveLength(0);
    expect(rows()[0].querySelector('select').tomselect.getValue()).toBe('k1');
  });

  test('without the marker, a select the page enhanced stays plain in inserted rows', () => {
    setup({ marked: false }, { unmarked: 'kind' });

    insert(options(), button(0, '.add-item'));

    expect(document.getElementById('formmodel-0-kind').tomselect).toBeDefined();
    expect(document.getElementById('formmodel-1-kind').tomselect).toBeUndefined();
    expect(rows()[1].querySelectorAll('.ts-wrapper')).toHaveLength(0);
  });

  test('a renumbered TomSelect points its ARIA references and option ids at its own row', () => {
    setup({ rows: [{}, {}] });

    // A search leaves the options it does not match rendered but out of the listbox.
    const searched = document.getElementById('formmodel-1-tags').tomselect;

    searched.refreshOptions(false);
    searched.setTextboxValue('Blue');
    searched.refreshOptions(false);
    expect(searched.dropdown_content.querySelectorAll('.option')).toHaveLength(1);

    remove(options(), button(0, '.remove-item'));
    searched.setTextboxValue('');
    insert(options(), button(0, '.add-item'));

    const selects = Array.from(document.querySelectorAll('.item select.tomselected'));

    expect(selects.map((select) => select.id)).toEqual(['formmodel-0-kind', 'formmodel-0-tags', 'formmodel-1-kind', 'formmodel-1-tags']);
    expect(selects.flatMap(identityIssues)).toEqual([]);
    expect(duplicateIds()).toEqual([]);
  });

  test('a deleted row releases its TomSelect instances and their document listeners', () => {
    setup({ rows: [{ kind: 'k1' }, { kind: 'k2', tags: ['t1'] }] });

    const deleted = ['formmodel-1-kind', 'formmodel-1-tags'].map((id) => document.getElementById(id));
    const instances = deleted.map((select) => select.tomselect);
    const reacting = instances.map((instance) => vi.spyOn(instance, 'inputState'));
    const kept = vi.spyOn(document.getElementById('formmodel-0-kind').tomselect, 'inputState');

    remove(options(), button(1, '.remove-item'));
    document.body.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true }));

    expect(deleted.map((select) => select.tomselect), 'instances released').toEqual([undefined, undefined]);
    expect(reacting.map((spy) => spy.mock.calls.length), 'deleted instances ignore the document').toEqual([0, 0]);
    expect(kept, 'live instances still listen').toHaveBeenCalledTimes(1);
  });
});
