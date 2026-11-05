import { beforeAll, describe, expect, test } from 'vitest';

import { options, rows, tabularForm } from './fixtures/tabular.js';
import { mount } from './support/dom.js';
import { loadEnvironment } from './support/environment.js';

/**
 * Method dispatch contract of `jQuery.fn.yiiDynamicForm`.
 */
beforeAll(loadEnvironment);

describe('method dispatch', () => {
  test('initialization with an options object returns the collection for chaining', () => {
    const fixture = tabularForm();
    const $ = window.jQuery;

    mount(fixture, { init: false });
    const $form = $('#dynamic-form');

    expect($form.yiiDynamicForm(options()), 'Init must return the same collection.').toBe($form);
  });

  test('initialization parses the template once, before any row is inserted', () => {
    mount(tabularForm());

    expect(
      [typeof options().template, options().template.find?.('#formmodel-0-name').val()],
      'Template must become a parsed, blank jQuery collection.',
    ).toEqual(['object', '']);
    expect(rows(), 'Initialization must not change the rendered rows.').toHaveLength(1);
  });

  test('an unknown method raises a jQuery error naming it', () => {
    const $ = window.jQuery;

    mount(tabularForm());

    expect(() => $('#dynamic-form').yiiDynamicForm('nope'), 'Unknown methods must not be ignored.').toThrow(
      'Method nope does not exist on jQuery.yiiDynamicForm',
    );
  });
});
