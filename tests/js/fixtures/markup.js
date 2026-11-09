/**
 * Builders for the markup that Yii's `ActiveForm`/`Html` helpers render for tabular inputs.
 *
 * They mirror the default Yii 2 ActiveField template closely enough for the plugin: a `.field-<id>` container, a
 * `label[for]`, the control and a `.help-block`. Values, and the ids of `field()` and `textInput()`, are escaped for
 * attribute context.
 */
const escape = (value) =>
  String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function field(id, label, control) {
  return `<div class="form-group field-${escape(id)}"><label class="control-label" for="${escape(id)}">${label}</label>${control}<div class="help-block"></div></div>`;
}

export function textInput(id, name, value = '') {
  return `<input type="text" id="${escape(id)}" class="form-control" name="${name}" value="${escape(value)}">`;
}

export function hiddenInput(id, name, value = '') {
  return `<input type="hidden" id="${id}" name="${name}" value="${escape(value)}">`;
}

export function textarea(id, name, value = '') {
  return `<textarea id="${id}" class="form-control" name="${name}">${escape(value)}</textarea>`;
}

/** Renders `Html::activeCheckbox()`: the unchecked sentinel followed by the labelled checkbox. */
export function checkbox(id, name, { value = '1', uncheck = '0', checked = false, label = 'Flag' } = {}) {
  return `<input type="hidden" name="${name}" value="${escape(uncheck)}"><label><input type="checkbox" id="${id}" name="${name}" value="${escape(value)}"${checked ? ' checked' : ''}> ${label}</label>`;
}

/** Renders `Html::activeRadioList()`: the unchecked sentinel followed by the radio group. */
export function radioList(id, name, items, selected = null) {
  const radios = Object.entries(items)
    .map(
      ([value, label]) =>
        `<label><input type="radio" name="${name}" value="${escape(value)}"${value === selected ? ' checked' : ''}> ${label}</label>`,
    )
    .join('');

  return `<input type="hidden" name="${name}" value=""><div id="${id}" role="radiogroup">${radios}</div>`;
}

/** Renders `Html::activeDropDownList()`; `multiple` adds the `[]` suffix and the empty sentinel like Yii does. */
export function select(id, name, items, { selected = [], prompt = null, multiple = false, attributes = '' } = {}) {
  const options = Object.entries(items)
    .map(
      ([value, label]) =>
        `<option value="${escape(value)}"${selected.includes(value) ? ' selected' : ''}>${label}</option>`,
    )
    .join('');
  const promptOption = prompt === null ? '' : `<option value="">${prompt}</option>`;

  if (multiple) {
    return `<input type="hidden" name="${name}" value=""><select id="${id}" class="form-control" name="${name}[]" multiple size="4"${attributes}>${promptOption}${options}</select>`;
  }

  return `<select id="${id}" class="form-control" name="${name}"${attributes}>${promptOption}${options}</select>`;
}

export const buttons = (insert = 'add-item', remove = 'remove-item') =>
  `<button type="button" class="${insert}">Add</button><button type="button" class="${remove}">Remove</button>`;

/**
 * Client validation entry as `ActiveForm` registers it for a required attribute.
 */
export function requiredAttribute(id, attribute, message) {
  return {
    id,
    name: attribute,
    container: `.field-${id}`,
    input: `#${id}`,
    error: '.help-block',
    validate(_attribute, value, messages) {
      window.yii.validation.required(value, messages, { message });
    },
  };
}

/**
 * Client validation entry for a pattern rule, so rows can carry intentionally different rules.
 */
export function patternAttribute(id, attribute, pattern, message) {
  return {
    id,
    name: attribute,
    container: `.field-${id}`,
    input: `#${id}`,
    error: '.help-block',
    validate(_attribute, value, messages) {
      window.yii.validation.regularExpression(value, messages, { pattern, not: false, message, skipOnEmpty: 1 });
    },
  };
}

/**
 * Options of one widget as `DynamicFormWidget` serializes them, in its key order, with the defaults the fixtures share.
 */
export const widgetOptions = (options) => ({
  widgetContainer: options.widgetContainer,
  widgetBody: '.items',
  widgetItem: '.item',
  limit: 9,
  insertButton: '.add-item',
  deleteButton: '.remove-item',
  insertPosition: 'bottom',
  formId: options.formId,
  min: 1,
  fields: [],
  template: options.template,
  ...options,
});
