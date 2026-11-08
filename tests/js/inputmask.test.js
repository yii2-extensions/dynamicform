import { beforeAll, describe, expect, test } from 'vitest';

import { inputmaskForm, inputmaskRow, maskRenderedInputs } from './fixtures/inputmask.js';
import { insert, mount, remove } from './support/dom.js';
import { loadInputmaskEnvironment } from './support/environment.js';

/**
 * Inputmask integration contracts with the real Inputmask 5.0.10 jQuery build: inputs of inserted rows are masked from
 * the options their `data-plugin-inputmask` attribute names, and inputs that already have an instance keep it, with
 * the options the page set on it, instead of being masked again on every insertion and deletion. The PHP-rendered
 * browser tests cover the same integration in Chromium with Yii's `MaskedInput` widget.
 */
beforeAll(loadInputmaskEnvironment);

const options = () => window.dynamicform_im;
const rows = () => document.querySelectorAll('.dynamic_form .items > .item');
const button = (index, kind) => rows()[index].querySelector(kind);
const input = (id) => document.getElementById(id);

/** Counts the handlers Inputmask binds on the form, one `submit.inputmask` per mask call. */
const formSubmitHandlers = () =>
  (window.jQuery._data(input('im-form'), 'events')?.submit ?? []).filter((handler) => handler.namespace === 'inputmask').length;

function setup(fixtureOptions) {
  mount(inputmaskForm(fixtureOptions));
  maskRenderedInputs();
}

describe('Inputmask instances', () => {
  test('inserted rows are masked blank from the options their attribute names; existing rows keep their instance', () => {
    setup({ phones: ['555-0100', '555-0111'] });

    const $ = window.jQuery;

    // Changing an option masks the input again, with a new instance.
    $(input('formmodel-0-phone')).inputmask('option', { placeholder: '*' });

    const original = input('formmodel-0-phone').inputmask;

    insert(options(), button(0, '.add-item'));

    const clone = input('formmodel-2-phone');

    expect(rows()).toHaveLength(3);
    expect(input('formmodel-0-phone').inputmask, 'original instance').toBe(original);
    expect($(input('formmodel-0-phone')).inputmask('getemptymask'), 'option set by the page').toBe('***-****');
    expect([input('formmodel-0-phone').value, input('formmodel-1-phone').value]).toEqual(['555-0100', '555-0111']);
    expect(clone.inputmask, 'clone instance').toBeDefined();
    expect([clone.value, $(clone).inputmask('getemptymask')], 'clone value and mask').toEqual(['', '___-____']);
    expect(input('outside').inputmask.opts.mask, 'input outside the rows').toBe('999-9999');
  });

  test('renumbered rows keep their instance and value, and deleting a row binds no form handler for them', () => {
    setup({ phones: ['555-0100', '555-0111', '555-0122'] });

    const kept = input('formmodel-2-phone').inputmask;

    expect(formSubmitHandlers(), 'one per masked input of the page').toBe(4);

    remove(options(), button(1, '.remove-item'));

    expect(Array.from(rows(), (row) => row.querySelector('input').name)).toEqual(['FormModel[0][phone]', 'FormModel[1][phone]']);
    expect(input('formmodel-1-phone').inputmask, 'renumbered instance').toBe(kept);
    expect(input('formmodel-1-phone').value).toBe('555-0122');
    // The handler of the deleted input stays bound: Inputmask's `remove()` does not unbind handlers of the form.
    expect(formSubmitHandlers()).toBe(4);

    insert(options(), button(0, '.add-item'));

    expect(formSubmitHandlers(), 'one more for the masked input of the clone').toBe(5);
  });

  test('updateContainer masks a row the application appended outside addItem', () => {
    setup();

    const $ = window.jQuery;

    $('.dynamic_form .items').append(inputmaskRow(1, ''));
    $('.dynamic_form').yiiDynamicForm('updateContainer');

    expect(input('formmodel-1-phone').inputmask?.opts.mask, 'instance of the appended row').toBe('999-9999');
  });
});
