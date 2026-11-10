import { beforeAll, describe, expect, test } from 'vitest';

import { handlerCounts } from './fixtures/kartik.js';
import { enhanceKartikInputs, kartikInputsForm } from './fixtures/kartik-inputs.js';
import { insert, mount, remove } from './support/dom.js';
import { loadKartikInputsEnvironment } from './support/environment.js';

/**
 * Kartik input widget contracts with the real yii2-widget-timepicker 1.0.5, yii2-widget-fileinput 1.1.1,
 * yii2-widget-touchspin 1.2.4, yii2-money 1.2.3 and yii2-number 1.0.5 scripts: a clone gets one instance of each widget
 * with the options of the page, a rendered or renumbered row keeps its instances and listeners, and every input that
 * writes the value of a row writes it to its own row.
 */
beforeAll(loadKartikInputsEnvironment);

const options = () => window.dynamicform_inputs;
const button = (index, kind) => document.querySelectorAll('.item')[index].querySelector(kind);

function setup(rows) {
  mount(kartikInputsForm({ rows }));
  enhanceKartikInputs({ rows });
}

/** Returns, per event type, the number of jQuery handlers bound to an element. */
const listeners = (element) =>
  Object.fromEntries(Object.entries(window.jQuery._data(element, 'events') ?? {}).map(([type, handlers]) => [type, handlers.length]));

/** Returns the instance, and the DOM it generated, of each widget of a row. */
function widgets(index) {
  const $ = window.jQuery;
  const id = (attribute) => `formmodel-${index}-${attribute}`;
  const row = document.querySelectorAll('.item')[index];

  return {
    timepicker: $(`#${id('time')}`).data('timepicker'),
    fileinput: $(`#${id('file')}`).data('fileinput'),
    touchspin: $(`#${id('qty')}`).data('spinnerid'),
    numberControl: $(`#${id('total')}`).data('numberControl'),
    generated: {
      timepickerWidgets: row.querySelectorAll('.bootstrap-timepicker-widget').length,
      pickerListeners: listeners(row.querySelector('.picker')),
      touchspinButtons: Array.from(row.querySelectorAll('.bootstrap-touchspin-down, .bootstrap-touchspin-up'), (element) => element.className),
      fileinputs: row.querySelectorAll('.file-input').length,
    },
  };
}

/** Types a value into a display input and commits it, as leaving the input does. */
const commit = (id, value) => window.jQuery(document.getElementById(id)).val(value).trigger('change');

// The events MaskMoney listens to on a display input, plus the `change` that writes the value of the row.
const masked = ['blur', 'change', 'click', 'cut', 'dblclick', 'focus', 'keydown', 'keypress', 'mask', 'paste'];

describe('Kartik input widgets', () => {
  test('a clone gets one instance of each widget with the options of the page; a rendered row keeps its own', () => {
    const $ = window.jQuery;

    setup(1);
    const original = widgets(0);

    insert(options(), button(0, '.add-item'));

    const kept = widgets(0);
    const clone = widgets(1);
    for (const widget of ['timepicker', 'fileinput', 'touchspin', 'numberControl']) {
      expect(kept[widget], `The rendered row keeps its ${widget} instance.`).toBe(original[widget]);
    }
    expect(original.generated, 'The rendered row as the widgets generated it.').toEqual({
      timepickerWidgets: 1,
      pickerListeners: { click: 1 },
      touchspinButtons: [
        'btn btn-outline-secondary bootstrap-touchspin-down',
        'btn btn-outline-secondary bootstrap-touchspin-up',
      ],
      fileinputs: 1,
    });
    expect([kept.generated, clone.generated], 'One widget, one picker listener and one set of buttons per row.').toEqual([
      original.generated,
      original.generated,
    ]);
    expect(
      {
        timepicker: clone.timepicker.upArrowStyle,
        fileinput: clone.fileinput.language,
        maskMoney: $('#formmodel-1-amount-disp').val(),
        numberControl: clone.numberControl.options.displayId,
      },
      'The clone is initialized with the options of the page and its own display inputs.',
    ).toEqual({
      timepicker: 'fas fa-chevron-up',
      fileinput: 'en-US',
      maskMoney: '$ 0.00',
      numberControl: 'formmodel-1-total-disp',
    });
    expect(window.numbercontrol_0.displayId, 'The options of the rendered row are not changed.').toBe('formmodel-0-total-disp');

    commit('formmodel-1-total-disp', '1234.5');

    expect(
      [$('#formmodel-1-total-disp').val(), $('#formmodel-1-total').val()],
      'The NumberControl of the clone masks its display with the options of the page.',
    ).toEqual(['1,234.5', '1234.5']);
  });

  test('after a deletion renumbers the rows, each display input writes the value of its own row', () => {
    const $ = window.jQuery;
    const changes = [];

    setup(2);
    remove(options(), button(0, '.remove-item'));
    insert(options(), button(0, '.add-item'));
    $('#inputs-form').on('change', '[type=hidden]', (event) => changes.push(event.target.id));

    commit('formmodel-0-amount-disp', '$ 40.00');
    commit('formmodel-1-amount-disp', '$ 5.00');
    commit('formmodel-0-total-disp', '77');
    commit('formmodel-1-total-disp', '9');

    expect(
      [0, 1].map((index) => [$(`#formmodel-${index}-amount`).val(), $(`#formmodel-${index}-total`).val()]),
      'The renumbered row and the clone receive their own values.',
    ).toEqual([
      ['40', '77'],
      ['5', '9'],
    ]);
    expect(changes, 'Each committed value notifies its own hidden input once.').toEqual([
      'formmodel-0-amount',
      'formmodel-1-amount',
      'formmodel-0-total',
      'formmodel-1-total',
    ]);
    // A display MaskMoney masked once, with one `change` handler, is the reference for the handlers of every display.
    $('#inputs-form').append('<input type="text" id="reference-disp">');
    $('#reference-disp').maskMoney(window.maskmoney_kv).on('change', () => {});
    const reference = handlerCounts('reference-disp');
    const displays = () => [0, 1].map((index) => handlerCounts(`formmodel-${index}-amount-disp`));

    expect(Object.keys(reference), 'The reference listens to the MaskMoney events and change.').toEqual(masked);
    expect(displays(), 'Each display keeps one set of masking handlers and one handler writing its value, not the server one.').toEqual([
      reference,
      reference,
    ]);

    insert(options(), button(1, '.add-item'));
    remove(options(), button(2, '.remove-item'));

    expect(displays(), 'Further insertions and deletions bind no handler twice.').toEqual([reference, reference]);
  });
});
