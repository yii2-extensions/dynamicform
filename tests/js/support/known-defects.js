/**
 * Known defects of the plugin, keyed by test id and asset variant (`source` or `production`).
 *
 * Each entry names the finding (F-xx: adjudicated review finding, N-xx: characterization added while building the test
 * corpus) and the exact failure the defect currently produces. A test registered here still asserts the correct
 * contract; {@link defectTest} passes only while that contract fails with this signature, rethrows any other error and
 * fails once the contract holds, so the entry is removed together with the fix. `DYNAMICFORM_STRICT_DEFECTS=1` disables
 * the expectation and reports the real failures.
 *
 * Do not add entries to hide fixture errors or unexplained failures.
 */

/** The distributed `yii2-dynamic-form.min.js` is built from the source, so both variants share each entry. */
const both = (finding, failure) => ({ source: { finding, failure }, production: { finding, failure } });

export const knownDefects = {
  'values-defaults': both(
    'N-07: clones keep the template value attributes, so a form reset fills new rows with the first row values (Phase 4B)',
    'Reset must restore saved values and a blank clone.',
  ),
};
