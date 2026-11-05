import { buttons, field, textInput, widgetOptions } from './markup.js';

/**
 * Single-widget forms whose rows use unusual name or id shapes.
 */
function singleRowForm(formId, rowHtml) {
  return {
    html: `<form id="${formId}"><div class="dynamic_form" data-dynamicform="dynamicform_identity"><div class="items">${rowHtml}</div></div></form>`,
    widgets: {
      dynamicform_identity: widgetOptions({ widgetContainer: 'dynamic_form', limit: 5, formId, template: rowHtml }),
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

/** A numeric literal key (`2024`) precedes the row index; a regular expression cannot tell them apart. */
export function numericLiteralForm() {
  return singleRowForm(
    'numeric-form',
    `<div class="item">${textInput('model-2024-0-x', 'Model[2024][0][x]', 'kept')}${buttons()}</div>`,
  );
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
