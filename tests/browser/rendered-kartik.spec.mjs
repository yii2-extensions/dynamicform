// PHP-rendered integration tests with the real Kartik widgets: kartik-v/yii2-widget-select2 2.2.5 (Select2 4.0.13) and
// kartik-v/yii2-widget-depdrop 1.0.6 (dependent-dropdown 1.4.9), pinned in composer.json. The `kartik` scenario renders
// them through ActiveForm::field()->widget(); every Kartik script and every DepDrop or Select2 AJAX request is the real
// one, answered by the deterministic endpoints of tests/Support/Browser/router.php. Controls are operated through
// their own UI, or through `.val().trigger('change')`, the programmatic way both libraries document.

import { URLSearchParams } from 'node:url';

import { expect, expectKnownDefect, test } from './support/fixtures.mjs';
import { expectSubmitBlocked, openScenario, submitAndCapture, validatorIds } from './support/rendered.mjs';

const attributes = ['branch', 'tags', 'owner', 'country', 'region', 'site'];
const rows = (page, container) => page.locator(`.${container} .container-items > .item`);

/** Returns the id of an attribute of a row of the `kartik-form` widgets (`production` or `sales`). */
const rowId = (segment, index, attribute) => `row-${index}-${segment}-${attribute}`;
const numericId = (index, attribute) => `row-2024-${index}-${attribute}`;

/** Records the DepDrop requests (POST) and Select2 AJAX searches (GET) sent to the fixture endpoints. */
function recordRequests(page) {
  const requests = [];

  page.on('request', (request) => {
    const url = new URL(request.url());
    const match = url.pathname.match(/\/(depdrop|lookup)\/(\w+)$/);

    if (match === null) {
      return;
    }

    const body = new URLSearchParams(request.postData() ?? '');
    const all = {};

    for (const [key, value] of body) {
      const name = key.match(/^depdrop_all_params\[(.+)\]$/);

      if (name !== null) {
        all[name[1]] = value;
      }
    }

    requests.push(
      match[1] === 'depdrop'
        ? { list: match[2], parents: body.getAll('depdrop_parents[0]'), params: body.getAll('depdrop_params[0]'), all }
        : { list: match[2], q: url.searchParams.get('q') },
    );
  });

  return requests;
}

/** Waits until exactly `count` requests were recorded and no further one follows. */
async function settled(page, requests, count) {
  await expect.poll(() => requests.length, { message: 'expected requests' }).toBe(count);
  await page.waitForTimeout(400);
  expect(requests.length, 'no duplicated request may follow').toBe(count);

  return requests.splice(0);
}

/** Returns, per control id, the number of jQuery handlers bound for each event type. */
const handlerCounts = (page, ids) =>
  page.evaluate(
    (list) =>
      Object.fromEntries(
        list.map((id) => {
          const events = window.jQuery._data(document.getElementById(id), 'events') ?? {};

          return [id, Object.fromEntries(Object.entries(events).map(([type, handlers]) => [type, handlers.length]).sort())];
        }),
      ),
    ids,
  );

/** Returns the Select2/DepDrop state of the controls of one row. */
const rowState = (page, idOf) =>
  page.evaluate(
    (ids) =>
      Object.fromEntries(
        ids.map((id) => {
          const $ = window.jQuery;
          const $el = $(document.getElementById(id));
          const group = $el.closest('.form-group');

          return [
            id,
            {
              value: $el.val(),
              select2: $el.data('select2') !== undefined,
              containers: group.find('.select2-container').length,
              rendered: group.find('.select2-selection__rendered').text(),
              options: $el.find('option').map((i, option) => option.value).get(),
              name: $el.attr('name'),
              label: group.find(`label[for="${id}"]`).length,
            },
          ];
        }),
      ),
    attributes.map(idOf),
  );

/** Chooses an option through the Select2 dropdown of a control. */
async function chooseThroughSelect2(page, id, text, search) {
  await page.locator(`#${id} + .select2-container .select2-selection`).click();

  if (search !== undefined) {
    await page.locator('.select2-container--open .select2-search__field').fill(search);
  }

  await page.locator('.select2-container--open .select2-results__option', { hasText: text }).click();
}

const setValue = (page, id, value) =>
  page.evaluate(([target, next]) => window.jQuery(document.getElementById(target)).val(next).trigger('change'), [id, value]);

const originalProduction = {
  branch: 'b1',
  tags: ['t1', 't2'],
  owner: 'o2',
  country: 'es',
  region: 'es-north',
  site: 'es-main',
};

test('Select2 clones are blank, show their placeholder and own one Select2 each, from zero rows too', async ({ page }) => {
  expectKnownDefect('rendered-kartik-select2-clones');
  await openScenario(page, 'kartik');

  await page.locator('.dynamicform_production .add-first').click();
  await page.locator('.dynamicform_sales .add-first').click();

  for (const [idOf, rowName] of [
    [(attribute) => rowId('production', 1, attribute), (attribute) => `Row[1][Production][${attribute}]`],
    [(attribute) => rowId('sales', 0, attribute), (attribute) => `Row[0][Sales][${attribute}]`],
  ]) {
    const state = await rowState(page, idOf);

    expect(Object.values(state).map((control) => control.value)).toEqual(['', [], '', '', '', '']);
    expect(Object.values(state).map((control) => control.select2)).toEqual([true, true, true, false, false, true]);
    expect(Object.values(state).map((control) => control.containers)).toEqual([1, 1, 1, 0, 0, 1]);
    expect(state[idOf('branch')].rendered).toBe('Select branch');
    expect(state[idOf('owner')].rendered).toBe('Find owner');
    expect(state[idOf('site')].rendered).toBe('Select site');
    expect(state[idOf('tags')].name).toBe(`${rowName('tags')}[]`);
    expect(state[idOf('branch')].name).toBe(rowName('branch'));
    expect(Object.values(state).every((control) => control.label === 1), 'every label targets its control').toBe(true);
  }

  const original = await rowState(page, (attribute) => rowId('production', 0, attribute));

  expect(Object.fromEntries(attributes.map((a) => [a, original[rowId('production', 0, a)].value]))).toEqual(originalProduction);
  expect(original[rowId('production', 0, 'branch')].rendered).toBe('×North');
  expect(original[rowId('production', 0, 'site')].rendered).toBe('×Main site es');

  // Up to the limit, every row keeps exactly one Select2 container per enhanced control and no loading indicator.
  await page.locator('.dynamicform_production .add-first').click();
  await page.locator('.dynamicform_production .add-first').click();
  await expect(rows(page, 'dynamicform_production')).toHaveCount(4);

  for (const row of await rows(page, 'dynamicform_production').all()) {
    await expect(row.locator('.select2-container')).toHaveCount(4);
    await expect(row.locator('.kv-plugin-loading')).toHaveCount(0);
  }
});

test('Kartik options of original rows survive insertions and apply to clones', async ({ page }) => {
  expectKnownDefect('rendered-kartik-original-options');
  await openScenario(page, 'kartik');

  const toggleShown = async (id) => {
    await page.locator(`#${id} + .select2-container .select2-selection`).click();
    const shown = await page.locator(`.select2-container--open #s2-togall-${id}`).count();
    await page.keyboard.press('Escape');

    return shown;
  };

  // `showToggleAll` (Kartik's default for multiple selects) puts a "Select all" control into the dropdown.
  expect(await toggleShown(rowId('production', 0, 'tags')), 'toggle before any insertion').toBe(1);

  await page.locator('.dynamicform_production .add-first').click();
  expect(await toggleShown(rowId('production', 0, 'tags')), 'original toggle after one insertion').toBe(1);
  expect(await toggleShown(rowId('production', 1, 'tags')), 'clone toggle').toBe(1);

  await page.locator('.dynamicform_production .add-first').click();
  await page.locator('.dynamicform_production .item').nth(1).locator('.remove-item').click();
  expect(await toggleShown(rowId('production', 0, 'tags')), 'original toggle after insert/delete cycles').toBe(1);
  expect(await toggleShown(rowId('production', 1, 'tags')), 'renumbered clone toggle').toBe(1);
});

test('insert and delete cycles add no handler, and clones carry the handlers of the original row', async ({ page }) => {
  expectKnownDefect('rendered-kartik-handlers');
  await openScenario(page, 'kartik');

  const productionIds = (index) => attributes.map((attribute) => rowId('production', index, attribute));
  const numericIds = attributes.map((attribute) => numericId(0, attribute));
  const atLoad = await handlerCounts(page, [...productionIds(0), ...numericIds]);

  await page.locator('.dynamicform_production .add-first').click();
  await page.locator('.dynamicform_production .add-first').click();
  await page.locator('.dynamicform_production .add-first').click();
  await page.locator('.dynamicform_production .item').nth(2).locator('.remove-item').click();
  await page.locator('.dynamicform_production .add-first').click();

  expect(await handlerCounts(page, [...productionIds(0), ...numericIds]), 'original rows').toEqual(atLoad);

  const byAttribute = (counts) => Object.fromEntries(Object.entries(counts).map(([id, events]) => [id.split('-').pop(), events]));
  const original = byAttribute(await handlerCounts(page, productionIds(0)));

  for (const index of [1, 2, 3]) {
    expect(byAttribute(await handlerCounts(page, productionIds(index))), `clone ${index}`).toEqual(original);
  }
});

test('DepDrop requests carry the values of their own row after insertion, deletion and renumbering', async ({ page }) => {
  expectKnownDefect('rendered-kartik-depdrop-rows');
  const requests = recordRequests(page);
  await openScenario(page, 'kartik');
  const id = (index, attribute) => rowId('production', index, attribute);

  await page.locator('.dynamicform_production .add-first').click();
  await page.locator('.dynamicform_production .add-first').click();
  await setValue(page, id(1, 'branch'), 'b2');
  await setValue(page, id(2, 'branch'), 'b3');

  await page.locator(`#${id(1, 'country')}`).selectOption('fr');
  expect(await settled(page, requests, 2)).toEqual([
    { list: 'regions', parents: ['fr'], params: ['b2'], all: { [id(1, 'country')]: 'fr', [id(1, 'branch')]: 'b2' } },
    { list: 'sites', parents: ['fr'], params: [], all: { [id(1, 'country')]: 'fr' } },
  ]);
  await expect(page.locator(`#${id(1, 'region')} option`)).toHaveText(['Select region', 'North region fr', 'South region fr']);

  await page.locator(`#${id(2, 'country')}`).selectOption('it');
  expect(await settled(page, requests, 2)).toEqual([
    { list: 'regions', parents: ['it'], params: ['b3'], all: { [id(2, 'country')]: 'it', [id(2, 'branch')]: 'b3' } },
    { list: 'sites', parents: ['it'], params: [], all: { [id(2, 'country')]: 'it' } },
  ]);

  // The original row keeps its stored selection while the other rows load.
  expect(await page.locator(`#${id(0, 'region')}`).inputValue()).toBe('es-north');
  expect(await page.locator(`#${id(0, 'site')}`).inputValue()).toBe('es-main');

  // Deleting the original row renumbers the clones: former row 1 (fr, b2) becomes row 0, former row 2 (it, b3) row 1.
  await rows(page, 'dynamicform_production').nth(0).locator('.remove-item').click();
  await expect(rows(page, 'dynamicform_production')).toHaveCount(2);
  expect(await page.locator(`#${id(0, 'country')}`).inputValue()).toBe('fr');
  expect(await page.locator(`#${id(1, 'country')}`).inputValue()).toBe('it');

  await page.locator(`#${id(0, 'country')}`).selectOption('es');
  expect(await settled(page, requests, 2)).toEqual([
    { list: 'regions', parents: ['es'], params: ['b2'], all: { [id(0, 'country')]: 'es', [id(0, 'branch')]: 'b2' } },
    { list: 'sites', parents: ['es'], params: [], all: { [id(0, 'country')]: 'es' } },
  ]);
  await expect(page.locator(`#${id(0, 'region')} option`)).toHaveText(['Select region', 'North region es', 'South region es']);
  await expect(page.locator(`#${id(1, 'region')} option`)).toHaveText(['Select region', 'North region it', 'South region it']);

  await page.locator(`#${id(1, 'country')}`).selectOption('fr');
  expect(await settled(page, requests, 2)).toEqual([
    { list: 'regions', parents: ['fr'], params: ['b3'], all: { [id(1, 'country')]: 'fr', [id(1, 'branch')]: 'b3' } },
    { list: 'sites', parents: ['fr'], params: [], all: { [id(1, 'country')]: 'fr' } },
  ]);
  await expect(page.locator(`#${id(0, 'region')} option`)).toHaveText(['Select region', 'North region es', 'South region es']);
});

test('rows inserted at zero rows, deleted and inserted again keep one DepDrop each', async ({ page }) => {
  expectKnownDefect('rendered-kartik-zero-rows');
  const requests = recordRequests(page);
  await openScenario(page, 'kartik');
  const sales = (attribute) => rowId('sales', 0, attribute);

  await expect(rows(page, 'dynamicform_sales')).toHaveCount(0);

  for (const cycle of [1, 2]) {
    await page.locator('.dynamicform_sales .add-first').click();
    await expect(rows(page, 'dynamicform_sales')).toHaveCount(1);
    await setValue(page, sales('branch'), 'b3');
    await page.locator(`#${sales('country')}`).selectOption(cycle === 1 ? 'fr' : 'it');
    const country = cycle === 1 ? 'fr' : 'it';

    expect(await settled(page, requests, 2), `cycle ${cycle}`).toEqual([
      { list: 'regions', parents: [country], params: ['b3'], all: { [sales('country')]: country, [sales('branch')]: 'b3' } },
      { list: 'sites', parents: [country], params: [], all: { [sales('country')]: country } },
    ]);
    await expect(page.locator(`#${sales('site')} option`)).toHaveText(['Select site', `Main site ${country}`, `Depot ${country}`]);

    await rows(page, 'dynamicform_sales').nth(0).locator('.remove-item').click();
    await expect(rows(page, 'dynamicform_sales')).toHaveCount(0);
  }

  // The Production row was never touched: one request per dependent list for its own values.
  await page.locator(`#${rowId('production', 0, 'country')}`).selectOption('it');
  expect(await settled(page, requests, 2)).toEqual([
    {
      list: 'regions',
      parents: ['it'],
      params: ['b1'],
      all: { [rowId('production', 0, 'country')]: 'it', [rowId('production', 0, 'branch')]: 'b1' },
    },
    { list: 'sites', parents: ['it'], params: [], all: { [rowId('production', 0, 'country')]: 'it' } },
  ]);

  // Deleting the last Production row and inserting again also starts from the template.
  await rows(page, 'dynamicform_production').nth(0).locator('.remove-item').click();
  await page.locator('.dynamicform_production .add-first').click();
  await page.locator(`#${rowId('production', 0, 'country')}`).selectOption('fr');
  expect(await settled(page, requests, 2)).toEqual([
    { list: 'regions', parents: ['fr'], params: [''], all: { [rowId('production', 0, 'country')]: 'fr', [rowId('production', 0, 'branch')]: '' } },
    { list: 'sites', parents: ['fr'], params: [], all: { [rowId('production', 0, 'country')]: 'fr' } },
  ]);
});

test('a cloned DepDrop rendered as Select2 receives the events of the original while its options load', async ({ page }) => {
  expectKnownDefect('rendered-kartik-depdrop-select2-events');
  const requests = recordRequests(page);
  await openScenario(page, 'kartik');
  await page.locator('.dynamicform_production .add-first').click();

  // Kartik's initDepdropS2() turns the DepDrop events into a `change` of the Select2 control after each load.
  const eventsDuringLoad = async (index) => {
    const id = rowId('production', index, 'site');
    await page.evaluate((target) => {
      window.siteEvents = [];
      window.jQuery(document.getElementById(target)).on(
        'change.probe depdrop:beforeChange.probe depdrop:change.probe depdrop:afterChange.probe',
        (event) => window.siteEvents.push(event.type),
      );
    }, id);
    await page.locator(`#${rowId('production', index, 'country')}`).selectOption('fr');
    await settled(page, requests, 2);

    return page.evaluate((target) => {
      window.jQuery(document.getElementById(target)).off('.probe');

      return window.siteEvents;
    }, id);
  };

  const original = await eventsDuringLoad(0);
  expect(await eventsDuringLoad(1)).toEqual(original);
  await expect(page.locator(`#${rowId('production', 1, 'site')} option`)).toHaveText(['Select site', 'Main site fr', 'Depot fr']);
});

test('a Select2 AJAX search of a clone queries the endpoint once and sets only the clone', async ({ page }) => {
  expectKnownDefect('rendered-kartik-select2-ajax');
  const requests = recordRequests(page);
  await openScenario(page, 'kartik');
  await page.locator('.dynamicform_production .add-first').click();

  await chooseThroughSelect2(page, rowId('production', 1, 'owner'), 'Owner three', 'three');

  expect(requests.filter((request) => request.list === 'owners').at(-1)).toEqual({ list: 'owners', q: 'three' });
  expect(await page.locator(`#${rowId('production', 1, 'owner')}`).inputValue()).toBe('o3');
  expect(await page.locator(`#${rowId('production', 0, 'owner')}`).inputValue()).toBe('o2');
});

test('clones are validated and submit coherent names under the Production and Sales literal keys', async ({ page }) => {
  expectKnownDefect('rendered-kartik-payload-validation');
  const requests = recordRequests(page);
  await openScenario(page, 'kartik');
  await page.locator('.dynamicform_production .add-first').click();
  await page.locator('.dynamicform_sales .add-first').click();

  expect(await validatorIds(page, 'kartik-form')).toEqual(
    [
      rowId('production', 0, 'branch'),
      rowId('production', 0, 'country'),
      rowId('production', 1, 'branch'),
      rowId('production', 1, 'country'),
      rowId('sales', 0, 'branch'),
      rowId('sales', 0, 'country'),
    ].sort(),
  );

  await expectSubmitBlocked(page, '#kartik-form');
  await expect(page.locator(`.field-${rowId('production', 1, 'branch')} .help-block`)).toHaveText('Branch cannot be blank.');
  await expect(page.locator(`.field-${rowId('production', 0, 'branch')} .help-block`)).toHaveText('');

  await chooseThroughSelect2(page, rowId('production', 1, 'branch'), 'South');
  await expect(page.locator(`.field-${rowId('production', 1, 'branch')} .help-block`)).toHaveText('');
  await chooseThroughSelect2(page, rowId('production', 1, 'tags'), 'Blue');
  await page.locator(`#${rowId('production', 1, 'country')}`).selectOption('fr');
  await settled(page, requests, 2);
  await page.locator(`#${rowId('production', 1, 'region')}`).selectOption('fr-south');
  await chooseThroughSelect2(page, rowId('production', 1, 'site'), 'Depot fr');

  await chooseThroughSelect2(page, rowId('sales', 0, 'branch'), 'East');
  await page.locator(`#${rowId('sales', 0, 'country')}`).selectOption('it');
  await settled(page, requests, 2);

  const payload = await submitAndCapture(page, '#kartik-form');

  expect(payload.post.Row).toEqual([
    {
      Production: { id: '1', branch: 'b1', tags: ['t1', 't2'], owner: 'o2', country: 'es', region: 'es-north', site: 'es-main' },
      Sales: { id: '', branch: 'b3', tags: '', owner: '', country: 'it', region: '', site: '' },
    },
    { Production: { id: '', branch: 'b2', tags: ['t3'], owner: '', country: 'fr', region: 'fr-south', site: 'fr-depot' } },
  ]);
});

test('a numeric literal key before the index keeps DepDrop rows apart and each form keeps its own controls', async ({ page }) => {
  expectKnownDefect('rendered-kartik-numeric-form');
  const requests = recordRequests(page);
  await openScenario(page, 'kartik');

  const kartikIds = attributes.map((attribute) => rowId('production', 0, attribute));
  const kartikBefore = await handlerCounts(page, kartikIds);

  await page.locator('#numeric-form .add-item').first().click();
  await expect(rows(page, 'dynamicform_numeric')).toHaveCount(2);

  const clone = await rowState(page, (attribute) => numericId(1, attribute));
  expect(Object.values(clone).map((control) => control.name)).toEqual(
    attributes.map((attribute) => `Row[2024][1][${attribute}]${attribute === 'tags' ? '[]' : ''}`),
  );
  expect(Object.values(clone).map((control) => control.value)).toEqual(['', [], '', '', '', '']);

  await setValue(page, numericId(1, 'branch'), 'b2');
  await page.locator(`#${numericId(1, 'country')}`).selectOption('fr');
  expect(await settled(page, requests, 2)).toEqual([
    { list: 'regions', parents: ['fr'], params: ['b2'], all: { [numericId(1, 'country')]: 'fr', [numericId(1, 'branch')]: 'b2' } },
    { list: 'sites', parents: ['fr'], params: [], all: { [numericId(1, 'country')]: 'fr' } },
  ]);
  expect(await page.locator(`#${numericId(0, 'region')}`).inputValue()).toBe('es-north');

  // The other form was not re-enhanced: same values, containers and handlers.
  const kartik = await rowState(page, (attribute) => rowId('production', 0, attribute));
  expect(Object.fromEntries(attributes.map((a) => [a, kartik[rowId('production', 0, a)].value]))).toEqual(originalProduction);
  expect(await handlerCounts(page, kartikIds)).toEqual(kartikBefore);
  await expect(page.locator('#kartik-form .select2-container')).toHaveCount(4);

  const payload = await submitAndCapture(page, '#numeric-form');
  expect(Object.keys(payload.post.Row)).toEqual(['2024']);
  expect(payload.post.Row['2024'].map((row) => [row.branch, row.country])).toEqual([
    ['b1', 'es'],
    ['b2', 'fr'],
  ]);
});
