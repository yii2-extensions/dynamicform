import { vi } from 'vitest';

/**
 * Reads the observable state of rendered rows, controls and client validation.
 */
const describeControl = (control) => {
  const state = { tag: control.tagName.toLowerCase(), id: control.id || null, name: control.getAttribute('name') };

  if (control.type === 'checkbox' || control.type === 'radio') {
    state.type = control.type;
    state.value = control.value;
    state.checked = control.checked;
  } else if (control.tagName === 'SELECT') {
    state.value = control.multiple
      ? Array.from(control.selectedOptions, (option) => option.value)
      : control.value;
  } else {
    state.type = control.type;
    state.value = control.value;
  }

  if (control.disabled) {
    state.disabled = true;
  }

  return state;
};

/** Returns every control of each row, in document order. */
export function rowControls(rows) {
  return Array.from(rows, (row) => Array.from(row.querySelectorAll('input, select, textarea'), describeControl));
}

/**
 * Returns the identity of each text-like control: id, name, value, label text and `.field-*` container class.
 */
export function rowIdentities(rows) {
  return Array.from(rows, (row) =>
    Array.from(row.querySelectorAll('input:not([type=hidden]), select, textarea'), (control) => ({
      id: control.id,
      name: control.getAttribute('name'),
      value: control.value,
      label: control.id === '' ? null : (row.querySelector(`label[for="${control.id}"]`)?.textContent ?? null),
      container: control.closest('[class*="field-"]')?.className.match(/\bfield-[\w-]+/)?.[0] ?? null,
    })),
  );
}

/** Returns the ids of the attributes registered in `yiiActiveForm`, sorted. */
export function validatorIds(formId) {
  return window.jQuery(document.getElementById(formId)).data('yiiActiveForm').attributes.map((attribute) => attribute.id).sort();
}

/**
 * Runs the submit-time client validation of a form without submitting it and resolves with the error text of every
 * registered attribute once ActiveForm reports `afterValidate` (jQuery 3 resolves it on a later task).
 *
 * A submitting form shows its errors after a 200 ms `setTimeout`; fake timers run that delay and jQuery's deferred
 * tasks in order without waiting for them.
 */
export async function validate(formId) {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

  try {
    const errors = submitValidation(formId);

    await vi.runAllTimersAsync();

    return await errors;
  } finally {
    vi.useRealTimers();
  }
}

function submitValidation(formId) {
  const $ = window.jQuery;
  const $form = $(`#${formId}`);
  const data = $form.data('yiiActiveForm');

  return new Promise((resolve) => {
    $form.one('afterValidate', () => {
      // ActiveForm checks the flag right after this event, so it is reset once the current task ends.
      queueMicrotask(() => {
        data.validate_only = false;
      });
      resolve(
        Object.fromEntries(
          data.attributes
            .map((attribute) => [attribute.id, $form.find(attribute.container).find('.help-block').text()])
            .sort(([a], [b]) => a.localeCompare(b)),
        ),
      );
    });

    // `validate_only` is ActiveForm's own flag for validating a submission without submitting the form.
    data.validate_only = true;
    $form.yiiActiveForm('validate', true);
  });
}

/** Returns the serialized form payload as `[name, value]` pairs, as a submission would send them. */
export function payload(formId) {
  return window.jQuery(`#${formId}`).serializeArray().map(({ name, value }) => [name, value]);
}
