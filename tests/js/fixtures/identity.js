import { buttons, field, textInput, widgetOptions } from './markup.js';
import { tabularForm } from './tabular.js';

/**
 * Single-widget forms whose rows use unusual name or id shapes.
 */
function singleRowForm(formId, rowHtml, fields = []) {
  return {
    html: `<form id="${formId}"><div class="dynamic_form" data-dynamicform="dynamicform_identity"><div class="items">${rowHtml}</div></div></form>`,
    widgets: {
      dynamicform_identity: widgetOptions({ widgetContainer: 'dynamic_form', limit: 5, formId, fields, template: rowHtml }),
    },
    // ActiveForm always initializes; without client validation it has no attributes.
    validation: { [formId]: [] },
  };
}

/** Issue #4: a named array segment precedes the row index. */
export function namedSegmentForm() {
  const id = 'reporttemplategraphparameters-graph-wind-speed-correlation-0-y_id';

  return singleRowForm(
    'named-form',
    `<div class="item">${field(id, 'Y', textInput(id, 'ReportTemplateGraphParameters[graph-wind-speed-correlation][0][y_id]', '7'))}${buttons()}</div>`,
  );
}

/**
 * A numeric literal key (`2024`) precedes the row index; a regular expression cannot tell them apart. The key belongs
 * to the form name (`Model[2024]`), so the `fields` the widget emits for `formFields` `['x']` locate the index.
 */
export function numericLiteralForm() {
  return singleRowForm(
    'numeric-form',
    `<div class="item">${textInput('model-2024-0-x', 'Model[2024][0][x]', 'kept')}${buttons()}</div>`,
    [{ id: 'model-2024-{}-x', name: 'Model[2024][{}][x]' }],
  );
}

/**
 * The tabular widget with one more field per row, `Meta[<index>][5][ts]`, whose model prefix the widget does not
 * declare, so its row index is located by position: the first numeric segment is the row index of the flat widget and
 * the following `5` is a literal key. `rows` are `{ name, ts }` values; the template row has a blank `ts`.
 */
export function trailingLiteralKeyForm(rows) {
  const fixture = tabularForm({ rows: rows.map(({ name }) => ({ name })) });
  const button = '<button type="button" class="add-item">';
  const meta = (index, value) =>
    field(`meta-${index}-5-ts`, 'Timestamp', textInput(`meta-${index}-5-ts`, `Meta[${index}][5][ts]`, value));
  let index = 0;

  fixture.html = fixture.html.replace(new RegExp(button, 'g'), () => {
    const html = `${meta(index, rows[index].ts)}${button}`;

    index++;

    return html;
  });
  fixture.widgets.dynamicform_rows.template = fixture.widgets.dynamicform_rows.template.replace(button, `${meta(0, '')}${button}`);

  return fixture;
}

/** Custom ids that do not follow the tabular `<model>-<index>-<attribute>` pattern. */
export function customIdForm() {
  return singleRowForm(
    'custom-form',
    `<div class="item"><label for="custom-field">Extra</label>${textInput('custom-field', 'FormModel[0][extra]')}${textInput('plainid', 'FormModel[0][more]')}${buttons()}</div>`,
  );
}

/** Attribute and model names that contain digits. */
export function digitNamesForm() {
  return singleRowForm(
    'digit-form',
    `<div class="item">${field('form2model-0-line2', 'Line 2', textInput('form2model-0-line2', 'Form2Model[0][line2]', 'L2'))}${buttons()}</div>`,
  );
}

/**
 * Deleting each position of three rows: the remaining rows keep their values and are renumbered from zero.
 */
export const deletions = [
  { position: 'first', index: 0, names: ['B', 'C'] },
  { position: 'middle', index: 1, names: ['A', 'C'] },
  { position: 'last', index: 2, names: ['A', 'B'] },
];
