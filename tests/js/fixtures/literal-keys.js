import { buttons, field, hiddenInput, requiredAttribute, textInput, widgetOptions } from './markup.js';

/**
 * Rows whose names hold numeric literal keys around the row index, as `ActiveForm` and `DynamicFormWidget` render them
 * for a row model whose `formName()` holds a literal key (`Model[2024]`) and `formFields` `['name', '[7]code']`:
 *
 * - `Model[2024][<index>][id]`: hidden primary key, not a declared field.
 * - `Model[2024][<index>][name]`: required.
 * - `Model[2024][<index>][7][code]`: literal key `7` after the row index.
 *
 * Ids follow `Html::getInputId()` (`model-2024-<index>-7-code`), and `fields` carries the `{}` patterns the widget
 * serializes for each declared field.
 */
export const nameError = 'Name cannot be blank.';

/** Lowercased id prefix `Html::getInputId()` derives from a form name, such as `model-2024` for `Model[2024]`. */
export const idOf = (formName) => formName.toLowerCase().replace(/\]\[/g, '-').replace(/\[/g, '-').replace(/\]/g, '');

export function literalKeyRow(index, { id = '', name = '', code = '' } = {}, { formName = 'Model[2024]', codeAttribute = 'code' } = {}) {
  const prefix = idOf(formName);

  return (
    `<div class="item">${hiddenInput(`${prefix}-${index}-id`, `${formName}[${index}][id]`, id)}` +
    field(`${prefix}-${index}-name`, 'Name', textInput(`${prefix}-${index}-name`, `${formName}[${index}][name]`, name)) +
    field(
      `${prefix}-${index}-7-${codeAttribute}`,
      'Code',
      textInput(`${prefix}-${index}-7-${codeAttribute}`, `${formName}[${index}][7][${codeAttribute}]`, code),
    ) +
    `${buttons()}</div>`
  );
}

/**
 * One literal-key widget in the form `formId`. `rules(index)` returns the validators ActiveForm registered for a
 * rendered row; `registered` lists those rows, including the removed row of a zero-start form.
 */
function literalKeyWidget({
  formId,
  variable,
  rows,
  formName,
  codeAttribute,
  min,
  insertPosition,
  registered = rows.length === 0 ? [0] : rows.map((_row, index) => index),
  rules = (index) => [requiredAttribute(`${idOf(formName)}-${index}-name`, `[${index}]name`, nameError)],
}) {
  const shape = { formName, codeAttribute };
  const prefix = idOf(formName);

  return {
    html:
      `<div class="dynamicform_literal" data-dynamicform="${variable}">` +
      `<div class="items">${rows.map((row, index) => literalKeyRow(index, row, shape)).join('')}</div>` +
      '<button type="button" class="add-item add-first">Add</button></div>',
    options: widgetOptions({
      widgetContainer: 'dynamicform_literal',
      // The widget default, so multi-digit indexes can be reached.
      limit: 999,
      insertPosition,
      formId,
      min,
      fields: [
        { id: `${prefix}-{}-name`, name: `${formName}[{}][name]` },
        { id: `${prefix}-{}-7-${codeAttribute}`, name: `${formName}[{}][7][${codeAttribute}]` },
      ],
      template: literalKeyRow(0, rows[0] ?? {}, shape),
    }),
    attributes: registered.flatMap(rules),
  };
}

/**
 * A form `literal-form` with one literal-key widget. `validation: false` renders it without client validation;
 * `sibling` adds a second form `sibling-form` after it whose rows use the same names and ids and the same container
 * class, with its own widget.
 */
export function literalKeyForm({
  rows = [{ id: '1', name: 'Saved', code: 'A1' }],
  formName = 'Model[2024]',
  codeAttribute = 'code',
  min = 1,
  insertPosition = 'bottom',
  registered,
  rules,
  validation = true,
  sibling = false,
} = {}) {
  const main = literalKeyWidget({
    formId: 'literal-form',
    variable: 'dynamicform_literal',
    rows,
    formName,
    codeAttribute,
    min,
    insertPosition,
    registered,
    rules,
  });
  const other = literalKeyWidget({
    formId: 'sibling-form',
    variable: 'dynamicform_sibling',
    rows: [{ id: '9', name: 'Other', code: 'Z9' }],
    formName,
    codeAttribute,
    min: 1,
    insertPosition: 'bottom',
  });

  return {
    html: `<form id="literal-form">${main.html}</form>${sibling ? `<form id="sibling-form">${other.html}</form>` : ''}`,
    widgets: { dynamicform_literal: main.options, ...(sibling ? { dynamicform_sibling: other.options } : {}) },
    validation: {
      'literal-form': validation ? main.attributes : [],
      ...(sibling ? { 'sibling-form': other.attributes } : {}),
    },
  };
}

/**
 * Houses holding rooms with literal keys at both levels: houses posted under `House[2024]`, rooms under `Room[2024]`
 * with the room name behind the literal key `7` (`Room[2024][<house>][<room>][7][name]`). As `DynamicFormWidget`
 * emits them, the `fields` of the inner widget hold a single `{}` for the whole index path.
 */
function room(house, index, name = '') {
  const id = `room-2024-${house}-${index}-7-name`;

  return `<div class="room">${field(id, 'Room', textInput(id, `Room[2024][${house}][${index}][7][name]`, name))}<button type="button" class="remove-room">x</button></div>`;
}

function house(index, name, rooms) {
  const id = `house-2024-${index}-name`;

  return (
    `<div class="house">${field(id, 'House', textInput(id, `House[2024][${index}][name]`, name))}` +
    `<div class="dynamicform_inner" data-dynamicform="dynamicform_literal_rooms"><div class="rooms">${rooms
      .map((roomName, roomIndex) => room(index, roomIndex, roomName))
      .join('')}</div><button type="button" class="add-room">Add room</button></div>` +
    '<button type="button" class="remove-house">x</button></div>'
  );
}

export function literalNestedForm() {
  const firstHouse = house(0, 'h0', ['r00']);

  return {
    html:
      '<form id="literal-nested-form"><div class="dynamicform_outer" data-dynamicform="dynamicform_literal_houses">' +
      `<div class="houses">${firstHouse}</div><button type="button" class="add-house">Add house</button></div></form>`,
    widgets: {
      dynamicform_literal_houses: widgetOptions({
        widgetContainer: 'dynamicform_outer',
        widgetBody: '.houses',
        widgetItem: '.house',
        insertButton: '.add-house',
        deleteButton: '.remove-house',
        formId: 'literal-nested-form',
        fields: [{ id: 'house-2024-{}-name', name: 'House[2024][{}][name]' }],
        template: firstHouse,
      }),
      dynamicform_literal_rooms: widgetOptions({
        widgetContainer: 'dynamicform_inner',
        widgetBody: '.rooms',
        widgetItem: '.room',
        insertButton: '.add-room',
        deleteButton: '.remove-room',
        formId: 'literal-nested-form',
        fields: [{ id: 'room-2024-{}-7-name', name: 'Room[2024][{}][7][name]' }],
        template: room(0, 0, 'r00'),
      }),
    },
    validation: {
      'literal-nested-form': [
        requiredAttribute('house-2024-0-name', '[0]name', 'House cannot be blank.'),
        requiredAttribute('room-2024-0-0-7-name', '[0][0][7]name', 'Room cannot be blank.'),
      ],
    },
  };
}

export const literalRows = (formId = 'literal-form') => document.querySelectorAll(`#${formId} .items > .item`);
export const literalOptions = () => window.dynamicform_literal;
export const nestedInputs = () =>
  Array.from(document.querySelectorAll('#literal-nested-form input'), (input) => `${input.id}|${input.name}|${input.value}`);
