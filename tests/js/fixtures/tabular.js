import { buttons, field, hiddenInput, requiredAttribute, textInput, widgetOptions } from './markup.js';

/**
 * A single tabular widget like the README example: hidden primary key, required `name`, optional `code`.
 *
 * `rows` are the rows the server renders; `template` is the first rendered row (the widget sends it even when `min`
 * is 0 and the rows are removed). `registered` lists the row indexes whose attributes ActiveForm registered, which
 * includes the removed row of a zero-start form. Without client validation ActiveForm still initializes, with no
 * attributes, as Yii renders it.
 */
export const blankError = 'Name cannot be blank.';

export function tabularRow(index, { id = '', name = '', code = '' } = {}) {
  return (
    `<div class="item">${hiddenInput(`formmodel-${index}-id`, `FormModel[${index}][id]`, id)}` +
    field(`formmodel-${index}-name`, 'Name', textInput(`formmodel-${index}-name`, `FormModel[${index}][name]`, name)) +
    field(`formmodel-${index}-code`, 'Code', textInput(`formmodel-${index}-code`, `FormModel[${index}][code]`, code)) +
    `${buttons()}</div>`
  );
}

export function tabularForm({
  rows = [{ id: '1', name: 'Saved', code: 'A1' }],
  template = rows[0] ?? {},
  registered = rows.length === 0 ? [0] : rows.map((_row, index) => index),
  validation = true,
  min = 1,
  limit = 999,
  insertPosition = 'bottom',
} = {}) {
  return {
    html:
      '<form id="dynamic-form"><div class="dynamicform_wrapper" data-dynamicform="dynamicform_rows">' +
      `<div class="container-items">${rows.map((row, index) => tabularRow(index, row)).join('')}</div>` +
      '<button type="button" class="add-item add-first">Add</button></div></form>',
    widgets: {
      dynamicform_rows: widgetOptions({
        widgetContainer: 'dynamicform_wrapper',
        widgetBody: '.container-items',
        limit,
        insertPosition,
        formId: 'dynamic-form',
        min,
        fields: [
          { id: 'formmodel-{}-name', name: 'FormModel[{}][name]' },
          { id: 'formmodel-{}-code', name: 'FormModel[{}][code]' },
        ],
        template: tabularRow(0, template),
      }),
    },
    validation: validation
      ? {
          'dynamic-form': registered.map((index) =>
            requiredAttribute(`formmodel-${index}-name`, `[${index}]name`, blankError),
          ),
        }
      : { 'dynamic-form': [] },
  };
}

export const rows = () => document.querySelectorAll('.dynamicform_wrapper .container-items > .item');
export const options = () => window.dynamicform_rows;
export const insertButton = (index) => rows()[index].querySelector('.add-item');
export const removeButton = (index) => rows()[index].querySelector('.remove-item');
export const firstInsertButton = () => document.querySelector('.add-first');
