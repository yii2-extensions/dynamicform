/**
 * Loads the real client libraries and the DynamicForm asset under test into the jsdom window.
 *
 * Libraries are evaluated as classic scripts, as a browser would load them. The asset variant comes from
 * `DYNAMICFORM_JS_VARIANT` (set per Vitest project):
 *
 * - `source`: imports `yii2-dynamic-form.js` as a module so V8 coverage and Stryker instrumentation apply.
 * - `source-script`: evaluates the same file as a classic (sloppy-mode) script, to detect any behavior that depends
 *   on how the file is loaded.
 * - `production`: evaluates the distributed `yii2-dynamic-form.min.js` as a classic script.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Vitest runs from the repository root (the directory of vitest.config.mjs); jsdom gives modules an http URL.
const root = process.cwd();
// Third-party scripts may come from another checkout: Stryker runs in a sandbox without `vendor/`.
const libraryRoot = process.env.DYNAMICFORM_LIBRARY_ROOT ?? root;

for (const [base, file] of [
  [root, 'src/assets/yii2-dynamic-form.js'],
  [libraryRoot, 'vendor/yiisoft/yii2/assets/yii.activeForm.js'],
]) {
  if (!existsSync(join(base, file))) {
    throw new Error(`${join(base, file)} is missing; run Vitest from the repository root after composer and npm install.`);
  }
}

const libraries = [
  'node_modules/jquery/dist/jquery.js',
  'vendor/yiisoft/yii2/assets/yii.js',
  'vendor/yiisoft/yii2/assets/yii.validation.js',
  'vendor/yiisoft/yii2/assets/yii.activeForm.js',
  'node_modules/select2/dist/js/select2.full.js',
];

export const variant = process.env.DYNAMICFORM_JS_VARIANT ?? 'source';

/** Defect registry key of the loaded asset: both source variants share the source file. */
export const assetVariant = variant === 'production' ? 'production' : 'source';

function evaluateScript(base, path) {
  // Indirect eval runs the file in the global scope in sloppy mode, like a classic `<script>` element.
  (0, eval)(`${readFileSync(join(base, path), 'utf8')}\n//# sourceURL=${path}`);
}

/**
 * Loads jQuery, Yii, Yii ActiveForm, Yii validation, Select2 and the asset under test once per test file.
 */
export async function loadEnvironment() {
  if (window.jQuery?.fn.yiiDynamicForm !== undefined) {
    return window.jQuery;
  }

  for (const library of libraries) {
    evaluateScript(libraryRoot, library);
  }

  if (variant === 'source') {
    await import('../../../src/assets/yii2-dynamic-form.js');
  } else if (variant === 'source-script') {
    evaluateScript(root, 'src/assets/yii2-dynamic-form.js');
  } else if (variant === 'production') {
    evaluateScript(root, 'src/assets/yii2-dynamic-form.min.js');
  } else {
    throw new Error(`Unknown DYNAMICFORM_JS_VARIANT ${variant}.`);
  }

  if (typeof window.jQuery.fn.yiiDynamicForm !== 'function') {
    throw new Error(`The ${variant} asset did not register jQuery.fn.yiiDynamicForm.`);
  }

  return window.jQuery;
}
