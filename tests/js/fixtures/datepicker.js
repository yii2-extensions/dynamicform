import { buttons, field, widgetOptions } from './markup.js';

/**
 * Rows with the markup Kartik DatePicker 1.4.8 renders with Bootstrap 5: a prepended component (`data-datepicker-type`
 * 2) whose `.input-group.date` container holds the picker and remove buttons, a plain input (`TYPE_INPUT`, type 1) and
 * an inline calendar (`TYPE_INLINE`, type 4) whose container carries the date in `data-date`. `data-krajee-kvdatepicker`
 * names the global variable holding the options. The template is the first rendered row, values included, as
 * `DynamicFormWidget` serializes it; {@see initRenderedDatePickers} initializes the page as the DatePicker script does.
 */
const dateInput = (id, name, value, type, source) =>
  `<input type="text" id="${id}" class="form-control krajee-datepicker" name="${name}" value="${value}" ` +
  `data-datepicker-source="${source}" data-datepicker-type="${type}" data-krajee-kvDatepicker="kvDatepicker_date">`;

function row(index, [date, due, start]) {
  const id = (attribute) => `formmodel-${index}-${attribute}`;
  const name = (attribute) => `FormModel[${index}][${attribute}]`;
  const component =
    `<div id="${id('date')}-kvdate" class="input-group date">` +
    '<span class="input-group-text kv-date-picker"></span><span class="input-group-text kv-date-remove"></span>' +
    `${dateInput(id('date'), name('date'), date, 2, `${id('date')}-kvdate`)}</div>`;
  const inline =
    `<div id="${id('start')}-kvdate" data-date="${start}">` +
    `${dateInput(id('start'), name('start'), start, 4, `${id('start')}-kvdate`)}</div>`;

  return (
    '<div class="item">' +
    field(id('date'), 'Date', component) +
    field(id('due'), 'Due', dateInput(id('due'), name('due'), due, 1, id('due'))) +
    field(id('start'), 'Start', inline) +
    `${buttons()}</div>`
  );
}

export function datePickerForm({ dates = [['2025-03-10', '2025-04-01', '2025-02-03']] } = {}) {
  return {
    html:
      '<form id="dp-form"><div class="dynamic_form" data-dynamicform="dynamicform_dp">' +
      `<div class="items">${dates.map((values, index) => row(index, values)).join('')}</div></div></form>`,
    widgets: {
      dynamicform_dp: widgetOptions({
        widgetContainer: 'dynamic_form',
        formId: 'dp-form',
        fields: ['date', 'due', 'start'].map((attribute) => ({
          id: `formmodel-{}-${attribute}`,
          name: `FormModel[{}][${attribute}]`,
        })),
        template: row(0, dates[0]),
      }),
    },
    globals: { kvDatepicker_date: { format: 'yyyy-mm-dd', autoclose: true } },
  };
}

/** Initializes every rendered DatePicker as the DatePicker script does: the source element, then the remove button. */
export function initRenderedDatePickers() {
  const $ = window.jQuery;

  $('[data-krajee-kvdatepicker]').each(function () {
    $(`#${$(this).attr('data-datepicker-source')}`).kvDatepicker(window[$(this).attr('data-krajee-kvdatepicker')]);

    if ($(this).attr('data-datepicker-type') === '2') {
      window.initDPRemove(this.id);
    }
  });
}
