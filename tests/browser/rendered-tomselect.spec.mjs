// PHP-rendered integration tests with the real TomSelect 2.4.3 (npm `tom-select`, pinned in package.json), served
// locally by the fixture's asset bundle. The `tomselect` scenario renders the selects through ActiveForm::field(); the
// page initializes TomSelect on the marked selects with its own settings, as an application does, and DynamicForm
// initializes the marked selects of inserted rows. Controls are operated through the TomSelect UI or its documented
// `setValue()` API.

import { expect, expectKnownDefect, test } from './support/fixtures.mjs';
import { expectSubmitBlocked, openScenario, submitAndCapture } from './support/rendered.mjs';

const rowSelectors = {
  items: '#tomselect-form .container-items > .item',
  table: '#table-form table.container-rows > tbody > tr.item',
  rooms: '#nested-form .rooms > .item',
};
const rows = (page, key) => page.locator(rowSelectors[key]);

/**
 * Returns, per row, the state of every select: name, value of the select itself, whether TomSelect enhances it, the
 * plugins of its instance and every identity reference that does not point at its own row. The options of every
 * instance are rendered first, so stale option ids show up.
 */
const selectsOf = (page, key) =>
  page.evaluate((selector) => {
    const identityIssues = (select, row) => {
      const ts = select.tomselect;
      const label = row.querySelector(`label[for="${ts.focus_node.id}"]`);
      const issues = [];
      const expect = (what, actual, expected) => actual !== expected && issues.push(`${what}: ${actual} != ${expected}`);
      const active = ts.focus_node.getAttribute('aria-activedescendant');

      // The active option is checked before the options are rendered again, which would refresh the reference.
      if (active !== null) {
        expect('aria-activedescendant', ts.dropdown_content.querySelector(`[id="${active}"]`), ts.activeOption);
        expect('active option id', active.startsWith(`${select.id}-opt-`), true);
      }

      ts.refreshOptions(false);
      expect('wrapper', select.nextElementSibling === ts.wrapper && row.contains(ts.wrapper), true);
      expect('control id', ts.focus_node.id, `${select.id}-ts-control`);
      expect('dropdown id', ts.dropdown_content.id, `${select.id}-ts-dropdown`);
      expect('aria-controls', ts.focus_node.getAttribute('aria-controls'), ts.dropdown_content.id);
      expect('label', label !== null, true);
      expect('label id', label?.id, `${select.id}-ts-label`);
      expect('aria-labelledby', ts.focus_node.getAttribute('aria-labelledby'), label?.id);
      expect('listbox aria-labelledby', ts.dropdown_content.getAttribute('aria-labelledby'), label?.id);
      ts.dropdown_content.querySelectorAll('[id]').forEach((option) => {
        expect('option id', option.id.startsWith(`${select.id}-opt-`), true);
      });

      return issues;
    };

    return Array.from(document.querySelectorAll(selector), (row) =>
      Object.fromEntries(
        Array.from(row.querySelectorAll('select'), (select) => {
          const ts = select.tomselect;
          const value = select.multiple ? Array.from(select.selectedOptions, (o) => o.value) : select.value;

          return [
            select.id,
            {
              name: select.name,
              value,
              enhanced: ts !== undefined,
              select2: window.jQuery(select).data('select2') !== undefined,
              plugins: ts === undefined ? null : [...ts.plugins.names].sort(),
              issues: ts === undefined ? [] : identityIssues(select, row),
            },
          ];
        }),
      ),
    );
  }, rowSelectors[key]);

const duplicateIds = (page) =>
  page.evaluate(() => {
    const seen = new Map();

    document.querySelectorAll('[id]').forEach((element) => seen.set(element.id, (seen.get(element.id) ?? 0) + 1));

    return [...seen].filter(([, count]) => count > 1).map(([id]) => id);
  });

/** Sets values through the TomSelect API of each select (`setValue()` triggers `change` on the select). */
const setTomSelect = (page, values) =>
  page.evaluate((entries) => {
    for (const [id, value] of Object.entries(entries)) {
      document.getElementById(id).tomselect.setValue(value);
    }
  }, values);

/** Makes an option the active one of a single select and closes it; a single select keeps it after closing. */
const activate = (page, id, value) =>
  page.evaluate(
    ([target, option]) => {
      const ts = document.getElementById(target).tomselect;

      ts.refreshOptions(false);
      ts.setActiveOption(ts.getOption(option), false);
      ts.close();
    },
    [id, value],
  );

/** Chooses an option through the TomSelect dropdown of a select. */
async function chooseThroughTomSelect(page, id, value) {
  const wrapper = page.locator(`#${id} + .ts-wrapper`);

  await wrapper.locator('.ts-control').click();
  await wrapper.locator(`.ts-dropdown .option[data-value="${value}"]`).click();
  await page.keyboard.press('Escape');
}

/** Counts the `mousedown` listeners of the document (TomSelect binds one per instance) and the live instances. */
async function listenerState(page) {
  const cdp = await page.context().newCDPSession(page);
  const { result } = await cdp.send('Runtime.evaluate', { expression: 'document' });
  const { listeners } = await cdp.send('DOMDebugger.getEventListeners', { objectId: result.objectId });
  const instances = await page.evaluate(() => document.querySelectorAll('select.tomselected').length);
  await cdp.detach();

  return { mousedown: listeners.filter((listener) => listener.type === 'mousedown').length, instances };
}

const values = (state) => Object.fromEntries(Object.entries(state).map(([id, control]) => [id, control.value]));
const issues = (states) => states.flatMap((state) => Object.entries(state).flatMap(([id, c]) => c.issues.map((i) => `${id} ${i}`)));

test('clones from the PHP template get one TomSelect each while originals keep their instance and settings', async ({ page }) => {
  expectKnownDefect('rendered-tomselect-clones');
  await openScenario(page, 'tomselect');

  // The template is the server markup: no TomSelect class or wrapper, only the marker.
  const template = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-dynamicform]'), (container) => {
      const $template = window.jQuery(window[container.getAttribute('data-dynamicform')].template);

      return [$template.find('.tomselected, .ts-wrapper').length, $template.find('select[data-tomselect]').length];
    }),
  );

  expect(template, 'template markup per container').toEqual([
    [0, 2],
    [0, 2],
    [0, 1],
    [0, 1],
  ]);

  await page.evaluate(() => {
    document.querySelectorAll('select.tomselected').forEach((select) => (select.tomselect.loadedAs = select.id));
  });
  await page.locator('#tomselect-form .add-first').click();
  await expect(rows(page, 'items')).toHaveCount(3);

  const [first, second, clone] = await selectsOf(page, 'items');

  expect(values(first)).toEqual({ 'item-0-kind': 'k1', 'item-0-tags': ['t1', 't3'], 'item-0-color': 'red', 'item-0-level': 'l1' });
  expect(values(second)).toEqual({ 'item-1-kind': 'k2', 'item-1-tags': ['t2'], 'item-1-color': 'blue', 'item-1-level': 'l2' });
  expect(values(clone)).toEqual({ 'item-2-kind': '', 'item-2-tags': [], 'item-2-color': '', 'item-2-level': '' });
  expect(first['item-0-kind'].plugins, 'original settings').toEqual(['clear_button']);
  expect(first['item-0-tags'].plugins, 'original settings').toEqual(['remove_button']);
  // Inserted rows get the fixed settings of the plugin, whatever the application gave the original rows.
  expect(clone['item-2-kind'].plugins, 'clone settings').toEqual(['dropdown_input', 'remove_button']);
  expect(clone['item-2-tags'].plugins, 'clone settings').toEqual(['dropdown_input', 'remove_button']);

  for (const state of [first, second, clone]) {
    expect(Object.values(state).map((control) => control.enhanced), 'TomSelect only on the marked selects').toEqual([true, true, false, false]);
    expect(Object.values(state).map((control) => control.select2), 'Select2 only on the Kartik select').toEqual([false, false, false, true]);
  }

  expect(issues([first, second, clone])).toEqual([]);

  const instances = await page.evaluate(() => {
    const instance = (id) => document.getElementById(id).tomselect;

    return {
      kept: ['item-0-kind', 'item-0-tags', 'item-1-kind', 'item-1-tags'].map((id) => instance(id).loadedAs === id),
      tags: [instance('item-0-tags').settings.maxItems, Object.values(instance('item-0-tags').optgroups).map((group) => group.label)],
      cloneTags: [instance('item-2-tags').settings.maxItems, Object.values(instance('item-2-tags').optgroups).map((group) => group.label)],
      cloneKind: [Object.keys(instance('item-2-kind').options).sort(), instance('item-2-kind').getValue()],
      outside: document.getElementById('outside-filter').tomselect === undefined,
      wrappers: Array.from(document.querySelectorAll('#tomselect-form .form-group'), (group) => group.querySelectorAll('.ts-wrapper').length),
    };
  });

  expect(instances.kept, 'original instances are kept').toEqual([true, true, true, true]);
  expect(instances.tags, 'original multiple select: maxItems and option groups').toEqual([3, ['Warm', 'Cold']]);
  expect(instances.cloneTags, 'clone multiple select: option groups from the markup').toEqual([null, ['Warm', 'Cold']]);
  expect(instances.cloneKind, 'clone single select: empty prompt option, no value').toEqual([['', 'k1', 'k2', 'k3'], '']);
  expect(instances.outside, 'a select outside the rows stays plain').toBe(true);
  expect(instances.wrappers, 'one TomSelect wrapper per marked select').toEqual([0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0]);
  await expect(page.locator('#item-2-level + .select2-container'), 'clone Select2').toHaveCount(1);
  // The original shows its stored value; the clone shows the empty prompt option its settings allow as an item, with
  // the `remove_button` of those settings.
  await expect(page.locator('#item-0-kind + .ts-wrapper .ts-control .item')).toHaveText(['Kind one']);
  await expect(page.locator('#item-2-kind + .ts-wrapper .ts-control .item')).toHaveText(['Select kind×']);
  await expect(page.locator('#item-2-tags + .ts-wrapper .ts-control .item')).toHaveCount(0);
});

test('TomSelect items are not counted as rows for the limit and the minimum, also from zero rows', async ({ page }) => {
  expectKnownDefect('rendered-tomselect-row-count');
  await openScenario(page, 'tomselect');

  const limits = await page.evaluate(() => {
    const reached = [];

    document.querySelectorAll('[data-dynamicform]').forEach((container) => {
      window.jQuery(container).on('limitReached', (_event, limit) => reached.push([container.className, limit]));
    });
    window.limitsReached = reached;

    return reached.length;
  });

  expect(limits).toBe(0);

  for (let click = 0; click < 3; click++) {
    await page.locator('#tomselect-form .add-first').click();
  }

  await expect(rows(page, 'items'), 'items limit 4').toHaveCount(4);

  for (let click = 0; click < 4; click++) {
    await rows(page, 'items').last().locator('.remove-item').click();
  }

  await expect(rows(page, 'items'), 'items min 1').toHaveCount(1);
  expect(values((await selectsOf(page, 'items'))[0])).toEqual({
    'item-0-kind': 'k1',
    'item-0-tags': ['t1', 't3'],
    'item-0-color': 'red',
    'item-0-level': 'l1',
  });

  // min 0: the stored row can be deleted; rows inserted from zero rows are enhanced and blank.
  await rows(page, 'table').first().locator('.remove-item').click();
  await expect(rows(page, 'table')).toHaveCount(0);
  await page.locator('#table-form .add-first').click();
  await expect(rows(page, 'table')).toHaveCount(1);
  await setTomSelect(page, { 'row-2024-0-sales-tags': ['t1', 't2'] });
  await rows(page, 'table').first().locator('.remove-item').click();
  await expect(rows(page, 'table')).toHaveCount(0);

  for (let click = 0; click < 4; click++) {
    await page.locator('#table-form .add-first').click();
  }

  await expect(rows(page, 'table'), 'table limit 3').toHaveCount(3);

  const table = await selectsOf(page, 'table');

  expect(table.map(values)).toEqual([0, 1, 2].map((i) => ({ [`row-2024-${i}-sales-kind`]: '', [`row-2024-${i}-sales-tags`]: [] })));
  expect(table.every((state) => Object.values(state).every((control) => control.enhanced))).toBe(true);
  expect(issues(table)).toEqual([]);

  for (let click = 0; click < 3; click++) {
    await page.locator('#nested-form .add-room').click();
  }

  await expect(rows(page, 'rooms'), 'rooms limit 3').toHaveCount(3);
  expect(await page.evaluate(() => window.limitsReached)).toEqual([
    ['dynamicform_items', 4],
    ['dynamicform_table', 3],
    ['dynamicform_rooms', 3],
  ]);
});

test('ids, names, labels and ARIA references follow each row across insertion, prepend, deletion and reinsertion', async ({ page }) => {
  expectKnownDefect('rendered-tomselect-identity');
  await openScenario(page, 'tomselect');

  await page.locator('#tomselect-form .add-first').click();
  await page.locator('#tomselect-form .add-first').click();
  await expect(rows(page, 'items')).toHaveCount(4);
  await setTomSelect(page, { 'item-2-kind': 'k3', 'item-3-tags': ['t4'] });
  await activate(page, 'item-2-kind', 'k1');
  await rows(page, 'items').nth(1).locator('.remove-item').click();
  await page.locator('#tomselect-form .add-first').click();

  const items = await selectsOf(page, 'items');

  expect(items.map((state) => Object.values(state).map((control) => control.name))).toEqual(
    [0, 1, 2, 3].map((i) => [`Item[${i}][kind]`, `Item[${i}][tags][]`, `Item[${i}][color]`, `Item[${i}][level]`]),
  );
  expect(items.map((state) => Object.values(state).slice(0, 2).map((control) => control.value))).toEqual([
    ['k1', ['t1', 't3']],
    ['k3', []],
    ['', ['t4']],
    ['', []],
  ]);
  expect(issues(items)).toEqual([]);

  // Rows inserted at the top renumber the stored row, which keeps its values under `Row[2024][<i>][Sales]`; its
  // listbox is mounted in the body by the page settings, so the row renaming does not reach it.
  await activate(page, 'row-2024-0-sales-kind', 'k2');
  await page.locator('#table-form .add-first').click();
  await page.locator('#table-form .add-first').click();
  await rows(page, 'table').nth(1).locator('.remove-item').click();
  await page.locator('#table-form .add-first').click();

  const table = await selectsOf(page, 'table');

  expect(table.map((state) => Object.values(state).map((control) => [control.name, control.value]))).toEqual([
    [['Row[2024][0][Sales][kind]', ''], ['Row[2024][0][Sales][tags][]', []]],
    [['Row[2024][1][Sales][kind]', ''], ['Row[2024][1][Sales][tags][]', []]],
    [['Row[2024][2][Sales][kind]', 'k3'], ['Row[2024][2][Sales][tags][]', ['t4']]],
  ]);
  expect(issues(table)).toEqual([]);

  await page.locator('#nested-form .add-room').click();
  await page.locator('#nested-form .add-house').click();
  await page.locator('#nested-form .house').nth(1).locator('.add-room').click();
  await rows(page, 'rooms').first().locator('.remove-room').click();

  const rooms = await selectsOf(page, 'rooms');

  expect(rooms.map((state) => Object.values(state).map((control) => [control.name, control.value, control.enhanced]))).toEqual([
    [['Room[0][0][tags][]', [], true]],
    [['Room[1][0][tags][]', [], true]],
    [['Room[1][1][tags][]', [], true]],
  ]);
  expect(issues(rooms)).toEqual([]);
  expect(await duplicateIds(page)).toEqual([]);
});

test('inserted TomSelect rows are validated and submitted under their own names', async ({ page }) => {
  expectKnownDefect('rendered-tomselect-payload-validation');
  await openScenario(page, 'tomselect');

  await page.locator('#tomselect-form .add-first').click();
  await expect(rows(page, 'items')).toHaveCount(3);
  await expectSubmitBlocked(page, '#tomselect-form');
  await expect(page.locator('.field-item-2-kind .help-block')).toHaveText('Kind cannot be blank.');
  await expect(page.locator('.field-item-1-kind .help-block')).toHaveText('');

  await chooseThroughTomSelect(page, 'item-2-kind', 'k3');
  await expect(page.locator('.field-item-2-kind .help-block')).toHaveText('');
  await chooseThroughTomSelect(page, 'item-2-tags', 't4');
  await page.locator('#item-2-name').fill('c2');

  const payload = await submitAndCapture(page, '#tomselect-form');

  expect(payload.post.Item).toEqual([
    { id: '1', name: 'n0', kind: 'k1', tags: ['t1', 't3'], color: 'red', level: 'l1' },
    { id: '2', name: 'n1', kind: 'k2', tags: ['t2'], color: 'blue', level: 'l2' },
    { id: '', name: 'c2', kind: 'k3', tags: ['t4'], color: '', level: '' },
  ]);
  expect(Object.keys(payload.post).sort(), 'TomSelect controls post nothing of their own').toEqual(['Item', '_csrf', 'filter']);
});

test('a native reset restores the selects of stored rows and leaves inserted rows blank', async ({ page }) => {
  expectKnownDefect('rendered-tomselect-reset');
  await openScenario(page, 'tomselect');

  await page.locator('#tomselect-form .add-first').click();
  await expect(rows(page, 'items')).toHaveCount(3);
  await setTomSelect(page, { 'item-0-kind': 'k3', 'item-0-tags': ['t2'], 'item-2-kind': 'k2', 'item-2-tags': ['t1', 't4'] });
  await page.evaluate(() => document.getElementById('tomselect-form').reset());

  const [first, second, clone] = (await selectsOf(page, 'items')).map(values);

  expect(first).toMatchObject({ 'item-0-kind': 'k1', 'item-0-tags': ['t1', 't3'] });
  expect(second).toMatchObject({ 'item-1-kind': 'k2', 'item-1-tags': ['t2'] });
  expect(clone).toMatchObject({ 'item-2-kind': '', 'item-2-tags': [] });
});

test('insert and delete cycles leave one instance, wrapper and document listener per live TomSelect', async ({ page }) => {
  expectKnownDefect('rendered-tomselect-instances');
  await openScenario(page, 'tomselect');

  const atLoad = await listenerState(page);
  const handlers = () =>
    page.evaluate(() =>
      ['item-0-kind', 'item-0-tags', 'row-2024-0-sales-kind', 'room-0-0-tags'].map((id) =>
        Object.entries(window.jQuery._data(document.getElementById(id), 'events') ?? {})
          .map(([type, list]) => `${type}:${list.length}`)
          .sort(),
      ),
    );
  const handlersAtLoad = await handlers();

  expect(atLoad.instances).toBe(7);

  for (let cycle = 0; cycle < 2; cycle++) {
    await page.locator('#tomselect-form .add-first').click();
    await page.locator('#tomselect-form .add-first').click();
    await expect(rows(page, 'items')).toHaveCount(4);
    await rows(page, 'items').nth(2).locator('.remove-item').click();
    await rows(page, 'items').nth(2).locator('.remove-item').click();
    await page.locator('#table-form .add-first').click();
    await rows(page, 'table').first().locator('.remove-item').click();
    await page.locator('#nested-form .add-room').click();
    await rows(page, 'rooms').last().locator('.remove-room').click();
  }

  await expect(rows(page, 'items')).toHaveCount(2);
  await expect(rows(page, 'table')).toHaveCount(1);
  await expect(rows(page, 'rooms')).toHaveCount(1);
  expect(await listenerState(page), 'live instances and their document listeners').toEqual(atLoad);
  expect(await handlers(), 'jQuery handlers of the stored selects').toEqual(handlersAtLoad);
  expect(await page.locator('.ts-wrapper').count(), 'one wrapper per instance').toBe(atLoad.instances);

  // Rows added after the cycles are enhanced once each.
  await page.locator('#tomselect-form .add-first').click();
  await page.locator('#nested-form .add-house').click();

  const after = await listenerState(page);

  expect(after.instances).toBe(atLoad.instances + 3);
  expect(after.mousedown - after.instances).toBe(atLoad.mousedown - atLoad.instances);
  expect(await page.locator('.ts-wrapper').count()).toBe(after.instances);

  // Deleting a house releases the instances of its nested rooms.
  await page.locator('#nested-form .house').nth(1).locator('.add-room').click();
  await page.locator('#nested-form .house').nth(1).locator('.remove-house').click();
  await expect(page.locator('#nested-form .house')).toHaveCount(1);
  expect(await listenerState(page)).toEqual({ mousedown: atLoad.mousedown + 2, instances: atLoad.instances + 2 });
});
