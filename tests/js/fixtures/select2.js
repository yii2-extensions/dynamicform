import { vi } from 'vitest';

import { buttons, select, widgetOptions } from './markup.js';

/**
 * Rows with Select2 controls marked the way `kartik-v/yii2-widget-select2` marks them (`data-krajee-select2` names the
 * global options variable).
 *
 * Kartik's own loading and dropdown-style callbacks (`initS2Loading`, `initSelect2DropStyle`) are not installed here;
 * they are replaced by recorders, so this layer verifies the plugin's Select2 handling, not Kartik integration.
 */
export function select2Form({ multiple = false } = {}) {
  const items = multiple ? { a: 'A', b: 'B', c: 'C' } : { saved: 'Saved', other: 'Other' };
  const selected = multiple ? ['a', 'b'] : ['saved'];
  const id = multiple ? 'formmodel-0-tags' : 'formmodel-0-kind';
  const name = multiple ? 'FormModel[0][tags]' : 'FormModel[0][kind]';
  const first =
    '<div class="item">' +
    select(id, name, items, {
      selected,
      prompt: multiple ? null : 'Choose',
      multiple,
      attributes: ' data-krajee-select2="select2_options"',
    }) +
    `${buttons()}</div>`;

  return {
    html:
      '<form id="select2-form"><div class="dynamic_form" data-dynamicform="dynamicform_select2">' +
      `<div class="items">${first}</div></div></form>`,
    widgets: {
      dynamicform_select2: widgetOptions({ widgetContainer: 'dynamic_form', limit: 5, formId: 'select2-form', template: first }),
    },
    globals: { select2_options: { placeholder: 'Choose' } },
    validation: { 'select2-form': [] },
  };
}

/** Installs Kartik's global callbacks as recorders and initializes Select2 on the server-rendered rows. */
export function enhanceSelect2() {
  const calls = [];

  vi.stubGlobal('initS2Loading', (id) => calls.push(['initS2Loading', id]));
  vi.stubGlobal('initSelect2DropStyle', (id) => calls.push(['initSelect2DropStyle', id]));
  window.jQuery('select[data-krajee-select2]').select2(window.select2_options);

  return calls;
}
