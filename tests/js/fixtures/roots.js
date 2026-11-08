import { buttons, field, requiredAttribute, textInput, widgetOptions } from './markup.js';

/**
 * Pages with several root widgets: two roots in one form sharing body/item selectors, independent forms, and rows
 * rendered as table body rows.
 */
function root({ formId, container, variable, model, values, insertClass }) {
  const row = (index, value) => {
    const id = `${model.toLowerCase()}-${index}-name`;

    return `<div class="item">${field(id, 'Name', textInput(id, `${model}[${index}][name]`, value))}${buttons(insertClass, `remove-${insertClass}`)}</div>`;
  };

  return {
    html: `<div class="${container}" data-dynamicform="${variable}"><div class="items">${values.map((value, index) => row(index, value)).join('')}</div></div>`,
    options: widgetOptions({
      widgetContainer: container,
      insertButton: `.${insertClass}`,
      deleteButton: `.remove-${insertClass}`,
      formId,
      fields: [{ id: `${model.toLowerCase()}-{}-name`, name: `${model}[{}][name]` }],
      template: row(0, values[0]),
    }),
    attributes: values.map((_value, index) =>
      requiredAttribute(`${model.toLowerCase()}-${index}-name`, `[${index}]name`, `${model} cannot be blank.`),
    ),
  };
}

/** Two roots in one form that share the `.items`/`.item` selectors; `first` and `second` are their row models. */
export function twoRootsForm({ first = 'A', second = 'B' } = {}) {
  const a = root({ formId: 'roots-form', container: 'dynamicform_a', variable: 'dynamicform_a', model: first, values: ['a0'], insertClass: 'add-a' });
  const b = root({ formId: 'roots-form', container: 'dynamicform_b', variable: 'dynamicform_b', model: second, values: ['b0', 'b1'], insertClass: 'add-b' });

  return {
    html: `<form id="roots-form">${a.html}${b.html}</form>`,
    widgets: { dynamicform_a: a.options, dynamicform_b: b.options },
    validation: { 'roots-form': [...a.attributes, ...b.attributes] },
  };
}

/**
 * Two forms with their own widgets; `sameContainer` reuses one container class for both and `sameModel` renders the
 * rows of both forms with the same model, so both forms contain the same input ids.
 */
export function twoFormsPage({ sameContainer = false, sameModel = false } = {}) {
  const a = root({ formId: 'form-a', container: 'dynamicform_wrapper', variable: 'dynamicform_first', model: 'A', values: ['a0'], insertClass: 'add-a' });
  const b = root({
    formId: 'form-b',
    container: sameContainer ? 'dynamicform_wrapper' : 'dynamicform_other',
    variable: 'dynamicform_second',
    model: sameModel ? 'A' : 'B',
    values: ['b0', 'b1'],
    insertClass: 'add-b',
  });

  return {
    html: `<form id="form-a">${a.html}</form><form id="form-b">${b.html}</form>`,
    widgets: { dynamicform_first: a.options, dynamicform_second: b.options },
    validation: { 'form-a': a.attributes, 'form-b': b.attributes },
  };
}

/**
 * A root rendered after the form it belongs to, whose `formId` contains quotes and CSS syntax; only the configured id
 * links the rows to the form.
 */
export function rootOutsideForm() {
  const formId = 'form."a\'b:[x]';
  const a = root({ formId, container: 'dynamicform_outside', variable: 'dynamicform_outside', model: 'A', values: ['a0'], insertClass: 'add-a' });

  return {
    formId,
    html: `<form id="${formId.replace(/"/g, '&quot;')}"></form>${a.html}`,
    widgets: { dynamicform_outside: a.options },
    validation: { [formId]: a.attributes },
  };
}

/**
 * A root rendered inside `host-form` whose configured `formId` names another id. With `otherForm` that id is a second
 * form, rendered after the host with one registered field of its own; without it no element has that id. It covers
 * the form lookup of the jQuery API only: `DynamicFormWidget` binds its click handlers and initialization on the
 * `formId` element, which therefore must be the form of the rows (docs/configuration.md).
 */
export function rootInsideForm({ formId, otherForm = false }) {
  const a = root({ formId, container: 'dynamicform_inside', variable: 'dynamicform_inside', model: 'A', values: ['a0'], insertClass: 'add-a' });
  const other = otherForm
    ? `<form id="${formId}">${field('other-0-name', 'Other', textInput('other-0-name', 'Other[0][name]', 'o0'))}</form>`
    : '';

  return {
    html: `<form id="host-form">${a.html}</form>${other}`,
    widgets: { dynamicform_inside: a.options },
    validation: {
      'host-form': a.attributes,
      ...(otherForm ? { [formId]: [requiredAttribute('other-0-name', '[0]name', 'Other cannot be blank.')] } : {}),
    },
  };
}

/** Issue #6 structure: rows are `tr` elements inside the `tbody` of the configured body table. */
export function tableRowsForm() {
  const row = (index, value) => {
    const id = `produce-${index}-name`;

    return `<tr class="produce-item"><td>${field(id, 'Name', textInput(id, `Produce[${index}][name]`, value))}</td><td>${buttons()}</td></tr>`;
  };

  return {
    html:
      '<form id="table-form"><div class="dynamicform_produce" data-dynamicform="dynamicform_table">' +
      `<table class="container-produce"><tbody>${row(0, 'Corn')}</tbody></table></div></form>`,
    widgets: {
      dynamicform_table: widgetOptions({
        widgetContainer: 'dynamicform_produce',
        widgetBody: '.container-produce',
        widgetItem: '.produce-item',
        formId: 'table-form',
        fields: [{ id: 'produce-{}-name', name: 'Produce[{}][name]' }],
        template: row(0, 'Corn'),
      }),
    },
    validation: { 'table-form': [requiredAttribute('produce-0-name', '[0]name', 'Name cannot be blank.')] },
  };
}

/** Returns `id|name|value` of every text input inside the selector. */
export const namesIn = (selector) =>
  Array.from(document.querySelectorAll(`${selector} input`), (input) => `${input.id}|${input.name}|${input.value}`);
