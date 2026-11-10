import { buttons, field, widgetOptions } from './markup.js';

/**
 * Rows with the markup the Kartik input widgets pinned in composer.json render for `FormModel[<i>][<attribute>]` with
 * Bootstrap 5: TimePicker 1.0.5, FileInput 1.1.1, TouchSpin 1.2.4, MaskMoney 1.2.3 (with the `$ ` prefix) and
 * NumberControl 1.0.5. Each widget names its options variable in `data-krajee-<plugin>`; NumberControl registers one
 * per rendered row, as its options name the display input of the row.
 */
const row = (index, { time = '', qty = '', amount = '', total = '' } = {}) => {
  const id = (attribute) => `formmodel-${index}-${attribute}`;
  const name = (attribute) => `FormModel[${index}][${attribute}]`;

  return (
    '<div class="item">' +
    field(
      id('time'),
      'Time',
      `<div class="bootstrap-timepicker input-group"><input type="text" id="${id('time')}" class="form-control" name="${name('time')}" value="${time}" data-krajee-timepicker="timepicker_kv"><span class="input-group-text picker"><i class="far fa-clock"></i></span></div>`,
    ) +
    field(
      id('file'),
      'File',
      `<input type="hidden" name="${name('file')}" value=""><input type="file" id="${id('file')}" class="file-loading" name="${name('file')}" data-krajee-fileinput="fileinput_kv">`,
    ) +
    field(id('qty'), 'Quantity', `<input type="text" id="${id('qty')}" name="${name('qty')}" value="${qty}" data-krajee-TouchSpin="touchspin_kv">`) +
    field(
      id('amount'),
      'Amount',
      `<input type="text" id="${id('amount')}-disp" class="form-control" name="${id('amount')}-disp" value="${amount}"><input type="hidden" id="${id('amount')}" name="${name('amount')}" value="${amount}" data-krajee-maskMoney="maskmoney_kv">`,
    ) +
    field(
      id('total'),
      'Total',
      `<input type="text" id="${id('total')}-disp" class="form-control" name="${id('total')}-disp" value="${total}"><div style="display:none"><input type="hidden" id="${id('total')}" name="${name('total')}" value="${total}" data-krajee-numberControl="numbercontrol_${index}"></div>`,
    ) +
    `${buttons()}</div>`
  );
};

const rendered = [
  { time: '10:30 AM', qty: '3', amount: '12.5', total: '1234.5' },
  { time: '11:45 PM', qty: '7', amount: '8', total: '42' },
];

export function kartikInputsForm({ rows = 1 } = {}) {
  const globals = {
    timepicker_kv: { upArrowStyle: 'fas fa-chevron-up', downArrowStyle: 'fas fa-chevron-down' },
    fileinput_kv: { language: 'en-US', resizeImage: false, autoOrientImage: true },
    touchspin_kv: { bsVersion: 5, buttonup_class: 'btn btn-outline-secondary', buttondown_class: 'btn btn-outline-secondary' },
    maskmoney_kv: { prefix: '$ ' },
  };

  rendered.slice(0, rows).forEach((_values, index) => {
    globals[`numbercontrol_${index}`] = {
      displayId: `formmodel-${index}-total-disp`,
      maskedInputOptions: { alias: 'numeric', digits: 2, groupSeparator: ',', radixPoint: '.', autoGroup: true, autoUnmask: false },
    };
  });

  return {
    html:
      '<form id="inputs-form"><div class="dynamic_form" data-dynamicform="dynamicform_inputs">' +
      `<div class="items">${rendered.slice(0, rows).map((values, index) => row(index, values)).join('')}</div></div></form>`,
    widgets: {
      dynamicform_inputs: widgetOptions({
        widgetContainer: 'dynamic_form',
        formId: 'inputs-form',
        template: row(0, rendered[0]),
        fields: ['time', 'file', 'qty', 'amount', 'total'].map((attribute) => ({
          id: `formmodel-{}-${attribute}`,
          name: `FormModel[{}][${attribute}]`,
        })),
      }),
    },
    globals,
    validation: { 'inputs-form': [] },
  };
}

/**
 * Runs, for every rendered row, the scripts the widgets register on DOM ready. MaskMoney binds the display input to the
 * ids of its row, which it looks up again on every event.
 */
export function enhanceKartikInputs({ rows = 1 } = {}) {
  const $ = window.jQuery;

  rendered.slice(0, rows).forEach((_values, index) => {
    const id = (attribute) => `formmodel-${index}-${attribute}`;

    $(`#${id('time')}`).timepicker(window.timepicker_kv);
    $(`#${id('file')}`).fileinput(window.fileinput_kv);
    $(`#${id('qty')}`).TouchSpin(window.touchspin_kv);
    $(`#${id('amount')}-disp`).maskMoney(window.maskmoney_kv);
    $(`#${id('amount')}-disp`).maskMoney('mask', parseFloat($(`#${id('amount')}`).val()));
    $(`#${id('amount')}-disp`).on('change keyup', (event) => {
      if (event.type === 'change' || event.which === 13) {
        $(`#${id('amount')}`).val($(`#${id('amount')}-disp`).maskMoney('unmasked')[0]).trigger('change');
      }
    });
    $(`#${id('total')}`).numberControl(window[`numbercontrol_${index}`]);
  });
}
