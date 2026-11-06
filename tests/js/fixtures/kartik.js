import { buttons, select, widgetOptions } from './markup.js';

/**
 * Rows with the markup `kartik-v/yii2-widget-select2` 2.2.5 and `kartik-v/yii2-widget-depdrop` 1.0.6 render: a Select2
 * (`data-krajee-select2` names its options variable, `data-s2-options` its Kartik options variable), a plain parent
 * select, a DepDrop (`data-krajee-depdrop`) whose request also carries the Select2 value (`params`), and a DepDrop
 * rendered as Select2, after Krajee's loading indicator. Every rendered row has its own DepDrop variables, as Kartik
 * registers one per widget. `declared: false` omits the `fields` metadata, like a widget configured without
 * `formFields`, so ids are located by their numeric segments.
 */
const row = (index, { kind, country, region, site }) => {
  const id = (attribute) => `formmodel-${index}-${attribute}`;
  const name = (attribute) => `FormModel[${index}][${attribute}]`;

  return (
    '<div class="item">' +
    `<div class="kv-plugin-loading loading-${id('kind')}">&nbsp;</div>` +
    select(id('kind'), name('kind'), { saved: 'Saved', other: 'Other' }, {
      selected: [kind],
      prompt: 'Choose',
      attributes: ' data-krajee-select2="select2_kind" data-s2-options="s2options_kartik"',
    }) +
    select(id('country'), name('country'), { es: 'Spain', fr: 'France', it: 'Italy' }, { selected: [country], prompt: '-' }) +
    select(id('region'), name('region'), { [region]: region }, {
      selected: [region],
      attributes: ` data-krajee-depdrop="depdrop_region_${index}"`,
    }) +
    select(id('site'), name('site'), { [site]: site }, {
      selected: [site],
      attributes: ` data-krajee-depdrop="depdrop_site_${index}" data-krajee-select2="select2_site" data-s2-options="s2options_kartik"`,
    }) +
    `${buttons()}</div>`
  );
};

const rendered = [
  { kind: 'saved', country: 'es', region: 'es-north', site: 'es-main' },
  { kind: 'other', country: 'fr', region: 'fr-north', site: 'fr-main' },
];

export function kartikForm({ declared = true } = {}) {
  const rows = rendered.map((values, index) => row(index, values)).join('');
  const globals = {
    select2_kind: { placeholder: 'Choose', width: 'auto' },
    select2_site: { placeholder: 'Site', width: 'auto' },
    s2options_kartik: { themeCss: '.select2-container--default', sizeCss: '', doReset: false, doToggle: false, doOrder: false },
  };

  rendered.forEach((_values, index) => {
    globals[`depdrop_region_${index}`] = {
      depends: [`formmodel-${index}-country`],
      params: [`formmodel-${index}-kind`],
      url: '/depdrop/regions',
    };
    globals[`depdrop_site_${index}`] = { depends: [`formmodel-${index}-country`], url: '/depdrop/sites' };
  });

  return {
    html:
      '<form id="kartik-form"><div class="dynamic_form" data-dynamicform="dynamicform_kartik">' +
      `<div class="items">${rows}</div></div></form>`,
    widgets: {
      dynamicform_kartik: widgetOptions({
        widgetContainer: 'dynamic_form',
        formId: 'kartik-form',
        limit: 6,
        template: row(0, rendered[0]),
        fields: declared
          ? ['kind', 'country', 'region', 'site'].map((attribute) => ({
              id: `formmodel-{}-${attribute}`,
              name: `FormModel[{}][${attribute}]`,
            }))
          : [],
      }),
    },
    globals,
  };
}

/** Runs, for every rendered row, the scripts Kartik registers on DOM ready. */
export function enhanceKartik() {
  const $ = window.jQuery;

  rendered.forEach((_values, index) => {
    const id = (attribute) => `formmodel-${index}-${attribute}`;

    $.when($(`#${id('kind')}`).select2(window.select2_kind)).done(window.initS2Loading(id('kind'), 's2options_kartik'));
    $(`#${id('region')}`).depdrop(window[`depdrop_region_${index}`]);
    $(`#${id('site')}`).depdrop(window[`depdrop_site_${index}`]);
    $.when($(`#${id('site')}`).select2(window.select2_site)).done(window.initS2Loading(id('site'), 's2options_kartik'));
    window.initDepdropS2(id('site'), 'Loading ...');
  });
}

/** Returns, per event type, the number of jQuery handlers bound to the element with the id. */
export function handlerCounts(id) {
  const events = window.jQuery._data(document.getElementById(id), 'events') ?? {};

  return Object.fromEntries(Object.entries(events).map(([type, handlers]) => [type, handlers.length]).sort());
}
