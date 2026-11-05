import { afterEach, vi } from 'vitest';

/**
 * Mounts fixtures into the jsdom document and drives the plugin through its public jQuery API.
 *
 * `mount()` performs what the PHP widget and ActiveForm emit: the markup, one global options variable per widget,
 * `yiiActiveForm()` per form (when the fixture has client validation) and the window-load `yiiDynamicForm(options)`
 * initialization. Insertion and deletion call the `addItem`/`deleteItem` methods the PHP click handlers call; the
 * handlers themselves are covered by the PHP-rendered browser tests.
 */
afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

export function mount(fixture, { init = true } = {}) {
  const $ = window.jQuery;

  document.body.innerHTML = fixture.html;

  for (const [name, value] of Object.entries({ ...fixture.widgets, ...fixture.globals })) {
    vi.stubGlobal(name, value);
  }

  for (const [formId, attributes] of Object.entries(fixture.validation ?? {})) {
    // jsdom has no layout, so ActiveForm's scroll-to-first-error measurement is disabled.
    $(document.getElementById(formId)).yiiActiveForm(attributes, { scrollToError: false });
  }

  if (init) {
    initialize(fixture);
  }

  return fixture.widgets;
}

/** Runs the window-load initialization of every widget of the fixture, in declaration order, as PHP emits it. */
export function initialize(fixture) {
  const $ = window.jQuery;

  for (const options of Object.values(fixture.widgets)) {
    $(document.getElementById(options.formId)).yiiDynamicForm(options);
  }
}

/** Calls `addItem` for the button, as the PHP insert handler does. */
export function insert(options, button) {
  const $ = window.jQuery;

  $(`.${options.widgetContainer}`).yiiDynamicForm('addItem', options, $.Event('click'), $(button));
}

/** Calls `deleteItem` for the button, as the PHP delete handler does. */
export function remove(options, button) {
  const $ = window.jQuery;

  $(`.${options.widgetContainer}`).yiiDynamicForm('deleteItem', options, $.Event('click'), $(button));
}
