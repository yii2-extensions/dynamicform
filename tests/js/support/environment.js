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

/**
 * Kartik scripts pinned in composer.json: dependent-dropdown 1.4.9, yii2-widget-depdrop 1.0.6 and
 * yii2-widget-select2 2.2.5. The unminified files are used; `depdrop.min.js` of yii2-widget-depdrop 1.0.6 is an older
 * build (1.0.3) that listens to the `depdrop.` event names dependent-dropdown dropped in 1.4.5.
 */
const kartikLibraries = [
  'vendor/kartik-v/dependent-dropdown/js/dependent-dropdown.js',
  'vendor/kartik-v/yii2-widget-depdrop/src/assets/js/depdrop.js',
  'vendor/kartik-v/yii2-widget-select2/src/assets/js/select2-krajee.js',
];

/** TomSelect 2.4.3 pinned in package.json: the complete build, with the plugins it bundles. */
const tomSelectLibrary = 'node_modules/tom-select/dist/js/tom-select.complete.js';

/** Inputmask 5.0.10 pinned in composer.json (`bower-asset/inputmask`): the build Yii's `MaskedInputAsset` publishes. */
const inputmaskLibrary = 'vendor/bower-asset/inputmask/dist/jquery.inputmask.js';

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

/**
 * Loads the environment plus the real Kartik DepDrop and Select2 scripts, as the Kartik asset bundles register them.
 */
export async function loadKartikEnvironment() {
  const $ = await loadEnvironment();

  if ($.fn.depdrop === undefined) {
    for (const library of kartikLibraries) {
      if (!existsSync(join(libraryRoot, library))) {
        throw new Error(`${join(libraryRoot, library)} is missing; run composer install (require-dev pins the Kartik widgets).`);
      }

      evaluateScript(libraryRoot, library);
    }
  }

  return $;
}

/**
 * Loads the environment plus the real TomSelect script, which defines the global `TomSelect` constructor.
 */
export async function loadTomSelectEnvironment() {
  const $ = await loadEnvironment();

  if (window.TomSelect === undefined) {
    if (!existsSync(join(libraryRoot, tomSelectLibrary))) {
      throw new Error(`${join(libraryRoot, tomSelectLibrary)} is missing; run npm ci (devDependencies pin tom-select).`);
    }

    evaluateScript(libraryRoot, tomSelectLibrary);
  }

  return $;
}

/**
 * Loads the environment plus the real Inputmask jQuery build, which defines `jQuery.fn.inputmask`.
 */
export async function loadInputmaskEnvironment() {
  const $ = await loadEnvironment();

  if ($.fn.inputmask === undefined) {
    if (!existsSync(join(libraryRoot, inputmaskLibrary))) {
      throw new Error(`${join(libraryRoot, inputmaskLibrary)} is missing; run composer install (require-dev pins bower-asset/inputmask).`);
    }

    // Inputmask detects a coarse pointer once, while the script loads; jsdom implements no `matchMedia`, so a desktop
    // pointer is reported for that evaluation only.
    window.matchMedia = () => ({ matches: false });

    try {
      evaluateScript(libraryRoot, inputmaskLibrary);
    } finally {
      delete window.matchMedia;
    }
  }

  return $;
}
