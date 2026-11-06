import { buttons, field, select, textInput, widgetOptions } from './markup.js';

/**
 * Rows with selects marked with `data-tomselect`, as the PHP widget renders them: a single select with an empty prompt
 * option, a multiple select with option groups and a plain select. The marker value names the settings the page applies
 * to the rendered selects ({@see enhanceTomSelect}); the template is the first rendered row, values included, as
 * `DynamicFormWidget` serializes it.
 */
const kinds = { k1: 'Kind one', k2: 'Kind two' };
const tagGroups = { Warm: { t1: 'Red', t2: 'Orange' }, Cold: { t3: 'Blue' } };

function groupedSelect(id, name, selected, attributes) {
  const groups = Object.entries(tagGroups)
    .map(
      ([group, options]) =>
        `<optgroup label="${group}">${Object.entries(options)
          .map(([value, label]) => `<option value="${value}"${selected.includes(value) ? ' selected' : ''}>${label}</option>`)
          .join('')}</optgroup>`,
    )
    .join('');

  return `<input type="hidden" name="${name}" value=""><select id="${id}" class="form-control" name="${name}[]" multiple size="4"${attributes}>${groups}</select>`;
}

function row(index, { kind = '', tags = [], marked = true, tag = 'div' } = {}) {
  const id = (attribute) => `formmodel-${index}-${attribute}`;
  const name = (attribute) => `FormModel[${index}][${attribute}]`;
  const marker = (value) => (marked ? ` data-tomselect="${value}"` : '');
  const cell = tag === 'tr' ? (content) => `<td>${content}</td>` : (content) => content;

  return (
    `<${tag} class="item">` +
    cell(field(id('name'), 'Name', textInput(id('name'), name('name')))) +
    cell(field(id('kind'), 'Kind', select(id('kind'), name('kind'), kinds, { selected: [kind], prompt: 'Select kind', attributes: marker('kind') }))) +
    cell(field(id('tags'), 'Tags', groupedSelect(id('tags'), name('tags'), tags, marker('tags')))) +
    cell(field(id('color'), 'Color', select(id('color'), name('color'), { red: 'Red' }, { prompt: 'Select color' }))) +
    cell(buttons()) +
    `</${tag}>`
  );
}

/**
 * Builds one form with one widget. `rows` lists the values of the rendered rows; `table` renders them as `tr.item` in
 * the `tbody` of `table.items`; `marked: false` renders the selects without the marker. A marked select outside the
 * rows stands for a control of the page that DynamicForm does not own.
 */
export function tomSelectForm({ rows = [{}], limit = 9, min = 1, table = false, marked = true } = {}) {
  const tag = table ? 'tr' : 'div';
  const rendered = rows.map((values, index) => row(index, { ...values, marked, tag })).join('');
  const body = table ? `<table class="items"><tbody>${rendered}</tbody></table>` : `<div class="items">${rendered}</div>`;
  const outside = select('outside', 'outside', kinds, { attributes: ' data-tomselect="kind"' });

  return {
    html: `<form id="ts-form"><div class="dynamic_form" data-dynamicform="dynamicform_ts">${body}</div>${outside}</form>`,
    widgets: {
      dynamicform_ts: widgetOptions({
        widgetContainer: 'dynamic_form',
        formId: 'ts-form',
        limit,
        min,
        fields: ['name', 'kind', 'tags', 'color'].map((attribute) => ({
          id: `formmodel-{}-${attribute}`,
          name: `FormModel[{}][${attribute}]`,
        })),
        template: row(0, { ...rows[0], marked, tag }),
      }),
    },
    validation: { 'ts-form': [] },
  };
}

/** Application settings per marker value; `kind` has no empty option item, so blank rows render no `.item`. */
export const pageSettings = { kind: { plugins: ['clear_button'] }, tags: { plugins: ['remove_button'], maxItems: 3 } };

/**
 * Initializes TomSelect on the selects of the rendered rows, as the page does on DOM ready: marked selects with the
 * settings their marker names, or every select of `name` when the rows are unmarked. `settings` adds settings per
 * marker value, such as `dropdownParent`.
 */
export function enhanceTomSelect({ unmarked = null, settings = {} } = {}) {
  const selector = unmarked === null ? '.item select[data-tomselect]' : `.item select[name$="[${unmarked}]"]`;

  document.querySelectorAll(selector).forEach((element) => {
    const marker = element.getAttribute('data-tomselect') ?? unmarked;

    new window.TomSelect(element, { ...pageSettings[marker], ...settings[marker] });
  });
}
