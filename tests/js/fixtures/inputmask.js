import { buttons, field, textInput, widgetOptions } from './markup.js';

/**
 * Rows with inputs marked the way Yii's `MaskedInput` marks them: `data-plugin-inputmask` names the global variable
 * holding the client options. The template is the first rendered row, values included, as `DynamicFormWidget`
 * serializes it; {@see maskRenderedInputs} masks the rendered inputs as the `MaskedInput` script does on DOM ready.
 */
const maskedInput = (id, name, value) =>
  textInput(id, name, value).replace('>', ' data-plugin-inputmask="inputmask_phone">');

/** One rendered row with a masked phone input. */
export function inputmaskRow(index, phone) {
  const id = `formmodel-${index}-phone`;

  return `<div class="item">${field(id, 'Phone', maskedInput(id, `FormModel[${index}][phone]`, phone))}${buttons()}</div>`;
}

export function inputmaskForm({ phones = ['555-0100'] } = {}) {
  return {
    html:
      '<form id="im-form"><div class="dynamic_form" data-dynamicform="dynamicform_im">' +
      `<div class="items">${phones.map((phone, index) => inputmaskRow(index, phone)).join('')}</div></div>` +
      `${maskedInput('outside', 'outside', '555-0199')}</form>`,
    widgets: {
      dynamicform_im: widgetOptions({
        widgetContainer: 'dynamic_form',
        formId: 'im-form',
        fields: [{ id: 'formmodel-{}-phone', name: 'FormModel[{}][phone]' }],
        template: inputmaskRow(0, phones[0]),
      }),
    },
    globals: { inputmask_phone: { mask: '999-9999' } },
  };
}

/** Masks every marked input of the page with the options its attribute names, as `MaskedInput` registers it. */
export function maskRenderedInputs() {
  const $ = window.jQuery;

  $('[data-plugin-inputmask]').each(function () {
    $(this).inputmask(window[$(this).attr('data-plugin-inputmask')]);
  });
}
