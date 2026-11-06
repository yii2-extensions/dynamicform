import { beforeAll, describe, expect, test, vi } from 'vitest';

import { enhanceKartik, handlerCounts, kartikForm } from './fixtures/kartik.js';
import { insert, mount, remove } from './support/dom.js';
import { loadKartikEnvironment } from './support/environment.js';

/**
 * Kartik integration contracts with the real dependent-dropdown 1.4.9, yii2-widget-depdrop 1.0.6 and
 * yii2-widget-select2 2.2.5 scripts: a DepDrop and a Select2 belong to the row they are in after every insertion,
 * deletion and renumbering, with one instance and one set of listeners each. Requests are captured at `jQuery.ajax`;
 * the PHP-rendered browser tests send them to a real endpoint.
 */
beforeAll(loadKartikEnvironment);

const options = () => window.dynamicform_kartik;
const button = (index, kind) => document.querySelectorAll('.item')[index].querySelector(kind);

function setup(fixtureOptions) {
  const $ = window.jQuery;
  const requests = [];

  mount(kartikForm(fixtureOptions));
  enhanceKartik();
  vi.spyOn($, 'ajax').mockImplementation((settings) => {
    requests.push({ url: settings.url, all: settings.data.depdrop_all_params });
  });

  return requests;
}

const change = (id, value) => window.jQuery(document.getElementById(id)).val(value).trigger('change');

describe('DepDrop rows', () => {
  test('a renumbered DepDrop keeps its instance and listeners and requests the values of its new row', () => {
    const $ = window.jQuery;
    const requests = setup();
    const instance = $('#formmodel-1-region').data('depdrop');
    const listeners = handlerCounts('formmodel-1-country');

    remove(options(), button(0, '.remove-item'));

    expect($('#formmodel-0-region').data('depdrop'), 'The DepDrop instance of the row must be kept.').toBe(instance);
    expect(
      { depends: instance.depends, params: $('#formmodel-0-region').data('params') },
      'The DepDrop must read the ids of its new row.',
    ).toEqual({ depends: ['formmodel-0-country'], params: ['formmodel-0-kind'] });
    expect(handlerCounts('formmodel-0-country'), 'Renumbering must not add a listener.').toEqual(listeners);

    change('formmodel-0-country', 'it');

    expect(requests, 'One request per dependent list, with the values of the renumbered row.').toEqual([
      { url: '/depdrop/regions', all: { 'formmodel-0-country': 'it', 'formmodel-0-kind': 'other' } },
      { url: '/depdrop/sites', all: { 'formmodel-0-country': 'it' } },
    ]);
  });

  test('without declared fields, a DepDrop takes the numeric segments of its row (issue #6 configuration)', () => {
    const $ = window.jQuery;
    const requests = setup({ declared: false });

    insert(options(), button(0, '.add-item'));
    remove(options(), button(0, '.remove-item'));

    expect(
      [0, 1].map((index) => [$(`#formmodel-${index}-region`).data('depdrop').depends, $(`#formmodel-${index}-region`).data('params')]),
      'Renumbered and inserted rows depend on their own row.',
    ).toEqual([
      [['formmodel-0-country'], ['formmodel-0-kind']],
      [['formmodel-1-country'], ['formmodel-1-kind']],
    ]);

    change('formmodel-1-country', 'es');

    expect(requests).toEqual([
      { url: '/depdrop/regions', all: { 'formmodel-1-country': 'es', 'formmodel-1-kind': '' } },
      { url: '/depdrop/sites', all: { 'formmodel-1-country': 'es' } },
    ]);
  });

  test('each inserted row gets one DepDrop of its own row and repeated insertions add no listener', () => {
    const $ = window.jQuery;
    const requests = setup();
    const original = $('#formmodel-0-region').data('depdrop');
    const listeners = handlerCounts('formmodel-0-country');

    insert(options(), button(0, '.add-item'));
    insert(options(), button(0, '.add-item'));
    insert(options(), button(0, '.add-item'));

    expect($('#formmodel-0-region').data('depdrop'), 'The rendered row keeps its DepDrop.').toBe(original);
    expect(
      [0, 1, 2, 3, 4].map((index) => handlerCounts(`formmodel-${index}-country`)),
      'Every parent select is listened to once by each of its two DepDrops.',
    ).toEqual([listeners, listeners, listeners, listeners, listeners]);
    expect(
      [2, 3, 4].map((index) => [$(`#formmodel-${index}-region`).data('depdrop').depends, $(`#formmodel-${index}-region`).data('params')]),
      'Clones depend on their own row.',
    ).toEqual([
      [['formmodel-2-country'], ['formmodel-2-kind']],
      [['formmodel-3-country'], ['formmodel-3-kind']],
      [['formmodel-4-country'], ['formmodel-4-kind']],
    ]);

    $('#formmodel-3-kind').val('saved');
    change('formmodel-3-country', 'fr');

    expect(requests).toEqual([
      { url: '/depdrop/regions', all: { 'formmodel-3-country': 'fr', 'formmodel-3-kind': 'saved' } },
      { url: '/depdrop/sites', all: { 'formmodel-3-country': 'fr' } },
    ]);
  });

  test("Kartik's Select2 handling of DepDrop requests is attached once, to each new row", () => {
    const $ = window.jQuery;

    setup();
    insert(options(), button(0, '.add-item'));
    insert(options(), button(0, '.add-item'));
    remove(options(), button(1, '.remove-item'));

    const afterChange = [0, 1, 2].map((index) => handlerCounts(`formmodel-${index}-site`)['depdrop:afterChange']);
    const changes = [];
    $('#formmodel-2-site').on('change', () => changes.push('change'));
    $('#formmodel-2-site').trigger('depdrop:beforeChange');
    const loading = $('#formmodel-2-site option').first().text();
    $('#formmodel-2-site').trigger('depdrop:afterChange');

    expect(
      { afterChange, loading, changes },
      // Kartik's handlers trigger `change` when the request starts (through `select2('val')`) and after the load.
      'initDepdropS2() runs once per DepDrop, shows the loading text and triggers change around a load.',
    ).toEqual({ afterChange: [1, 1, 1], loading: 'Loading ...', changes: ['change', 'change'] });
  });
});

describe('Select2 controls', () => {
  test('a Select2 keeps its instance while its id is unchanged and new or renumbered ones get their Kartik options', () => {
    const $ = window.jQuery;

    setup();
    const original = $('#formmodel-0-kind').data('select2');
    const loading = vi.spyOn(window, 'initS2Loading');

    insert(options(), button(0, '.add-item'));

    expect($('#formmodel-0-kind').data('select2'), 'An unchanged Select2 is not initialized again.').toBe(original);
    expect(
      {
        width: $('#formmodel-2-kind').data('select2').options.get('width'),
        loading: document.querySelectorAll('.kv-plugin-loading').length,
      },
      'A clone is initialized with its own configuration and without the loading indicator of the template row.',
    ).toEqual({ width: 'auto', loading: 0 });
    expect(loading.mock.calls, 'Only the new controls are initialized, with their Kartik options.').toEqual([
      ['formmodel-2-kind', 's2options_kartik'],
      ['formmodel-2-site', 's2options_kartik'],
    ]);

    loading.mockClear();
    remove(options(), button(0, '.remove-item'));

    expect(loading.mock.calls, 'Renumbered controls are initialized under their new id.').toEqual([
      ['formmodel-0-kind', 's2options_kartik'],
      ['formmodel-0-site', 's2options_kartik'],
      ['formmodel-1-kind', 's2options_kartik'],
      ['formmodel-1-site', 's2options_kartik'],
    ]);
    expect(
      Array.from(document.querySelectorAll('.item'), (item) => [
        item.querySelectorAll('.select2-container').length,
        $(item).find('[id$=kind]').data('select2').id,
      ]),
      'One Select2 per control, named after the current id.',
    ).toEqual([
      [2, 'select2-formmodel-0-kind'],
      [2, 'select2-formmodel-1-kind'],
    ]);
  });

  test('the Select2 3.x open handler is bound once, and only when initSelect2DropStyle exists', () => {
    const $ = window.jQuery;

    setup();
    insert(options(), button(0, '.add-item'));
    expect(handlerCounts('formmodel-2-kind')['select2-open'], 'Without the Kartik 1.x callback no handler is bound.').toBe(
      undefined,
    );

    const styled = [];
    vi.stubGlobal('initSelect2DropStyle', (id) => styled.push(id));
    insert(options(), button(0, '.add-item'));
    remove(options(), button(0, '.remove-item'));
    $('#formmodel-2-kind').trigger('select2-open');

    expect({
      handlers: handlerCounts('formmodel-2-kind')['select2-open'],
      kartik: handlerCounts('formmodel-2-kind')['select2:open'],
      styled,
    }).toEqual({ handlers: 1, kartik: 1, styled: ['formmodel-2-kind'] });
  });
});
