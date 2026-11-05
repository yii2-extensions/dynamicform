import { buttons, checkbox, field, hiddenInput, radioList, select, textarea, textInput, widgetOptions } from './markup.js';

/**
 * One widget whose rows contain every kind of control the plugin resets on cloning.
 */
const kinds = { a: 'A', b: 'B', c: 'C' };

export function controlsRow(index, values = {}) {
  const id = (attribute) => `formmodel-${index}-${attribute}`;
  const name = (attribute) => `FormModel[${index}][${attribute}]`;

  return (
    '<div class="item">' +
    hiddenInput(id('id'), name('id'), values.id ?? '') +
    field(id('name'), 'Name', textInput(id('name'), name('name'), values.name ?? '')) +
    field(id('notes'), 'Notes', textarea(id('notes'), name('notes'), values.notes ?? '')) +
    field(id('kind'), 'Kind', select(id('kind'), name('kind'), kinds, { selected: values.kind ?? [], prompt: 'Choose' })) +
    field(id('size'), 'Size', select(id('size'), name('size'), { s: 'S', m: 'M' }, { selected: values.size ?? [] })) +
    field(id('tags'), 'Tags', select(id('tags'), name('tags'), kinds, { selected: values.tags ?? [], multiple: true })) +
    field(id('flag'), 'Flag', checkbox(id('flag'), name('flag'), { value: 'yes', uncheck: 'no', checked: values.flag === true })) +
    field(id('level'), 'Level', radioList(id('level'), name('level'), { low: 'Low', high: 'High' }, values.level ?? null)) +
    `<input type="text" id="${id('locked')}" name="${name('locked')}" value="${values.locked ?? ''}" disabled>` +
    `${buttons()}</div>`
  );
}

export const savedValues = {
  id: '1',
  name: 'Saved',
  notes: 'Long text',
  kind: ['b'],
  size: ['m'],
  tags: ['a', 'c'],
  flag: true,
  level: 'high',
  locked: 'L',
};

export function controlsForm() {
  const first = controlsRow(0, savedValues);

  return {
    html:
      '<form id="controls-form"><div class="dynamicform_wrapper" data-dynamicform="dynamicform_controls">' +
      `<div class="container-items">${first}</div></div></form>`,
    widgets: {
      dynamicform_controls: widgetOptions({
        widgetContainer: 'dynamicform_wrapper',
        widgetBody: '.container-items',
        limit: 5,
        formId: 'controls-form',
        template: first,
      }),
    },
    validation: { 'controls-form': [] },
  };
}
