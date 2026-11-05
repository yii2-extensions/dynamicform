/**
 * Known defects of the plugin, keyed by test id and asset variant (`source` or `production`).
 *
 * Each entry names the finding (F-xx: adjudicated review finding, A-Fxx: original audit finding, N-xx: characterization
 * added while building the test corpus) and the exact failure the defect currently produces. A test registered here
 * still asserts the correct contract; {@link defectTest} passes only while that contract fails with this signature,
 * rethrows any other error and fails once the contract holds, so the entry is removed together with the fix.
 * `DYNAMICFORM_STRICT_DEFECTS=1` disables the expectation and reports the real failures.
 *
 * Do not add entries to hide fixture errors or unexplained failures.
 */
const staleProduction = 'F-04: the distributed minified asset does not contain the current source behavior';

export const knownDefects = {
  'identity-named-segment': {
    production: {
      finding: `${staleProduction}; issue #4 named segment throws while renaming the clone`,
      failure: "Cannot read properties of undefined (reading 'widgetItem')",
    },
  },
  'identity-digit-names': {
    production: {
      finding: `${staleProduction}; the 1.0.2 id pattern splits model names that contain digits (N-03)`,
      failure: 'Only the row index may change.',
    },
  },
  'identity-numeric-literal-key': {
    source: {
      finding: 'F-10: the row-index pattern rewrites the literal key 2024 of the existing row (Phase 4A)',
      failure: 'Literal key 2024 must survive; only the row index may change.',
    },
    production: {
      finding: 'F-10: the 1.0.2 algorithm throws while renaming two numeric segments without a nested widget',
      failure: "Cannot read properties of undefined (reading 'widgetItem')",
    },
  },
  'identity-custom-ids': {
    source: {
      finding: 'F-09: custom non-tabular ids are copied unchanged, so rows share ids (Phase 4A)',
      failure: 'Custom ids must be unique per row and labels must point inside their row.',
    },
    production: {
      finding: 'F-09: the 1.0.2 algorithm rewrites custom ids again on every update (Phase 4A)',
      failure: 'Custom ids must be stable across updates.',
    },
  },
  'ownership-two-roots': {
    production: {
      finding: `${staleProduction}; the 1.0.2 algorithm renumbers every row matching the item selector on the page`,
      failure: 'Only root A may change.',
    },
  },
  'ownership-independent-forms': {
    production: {
      finding: `${staleProduction}; the 1.0.2 algorithm renumbers rows of other forms`,
      failure: 'Each form must change only through its own widget.',
    },
  },
  'ownership-same-container-class': {
    source: {
      finding: 'N-06: rows are selected by container class across the page, so another form with that class is renumbered (C08, D02)',
      failure: 'The other form must keep its indexes.',
    },
    production: {
      finding: 'N-06: rows are selected by container class across the page, so another form with that class is renumbered (C08, D02)',
      failure: 'The other form must keep its indexes.',
    },
  },
  'values-defaults': {
    source: {
      finding: 'N-07: clones keep the template value attributes, so a form reset fills new rows with the first row values (Phase 4B)',
      failure: 'Reset must restore saved values and a blank clone.',
    },
    production: {
      finding: 'N-07: clones keep the template value and selected attributes, so a form reset fills new rows (Phase 4B)',
      failure: 'Reset must restore saved values and a blank clone.',
    },
  },
  'values-controls': {
    production: {
      finding: `${staleProduction}; the 1.0.2 reset copies selections, rewrites checkbox/radio values and unchecks the original radio (N-04)`,
      failure: 'Clone must be blank; sentinels and values kept.',
    },
  },
  'values-payload': {
    production: {
      finding: `${staleProduction}; the original radio value is lost from the payload and clone values are copied (N-04)`,
      failure: 'Disabled and unchecked controls must not be submitted.',
    },
  },
  'values-select2-multiple': {
    production: {
      finding: `${staleProduction}; the multiple Select2 clone keeps the original selections`,
      failure: 'Multiple clone must be empty and enhanced once.',
    },
  },
  'values-select2-single': {
    production: {
      finding: `${staleProduction}; issue #6 Select2 clone keeps the selection`,
      failure: 'Clone must be blank and enhanced once.',
    },
  },
  'validation-zero-start': {
    source: {
      finding: 'F-01: init() snapshots validators from visible rows, so a form without rows has no template (Phase 4C)',
      failure: 'Both inserted rows must run the required rule.',
    },
  },
  'validation-before-init': {
    source: {
      finding: 'F-01: a row inserted before init() is never given a validator (Phase 4C)',
      failure: 'Row inserted before init must run the required rule.',
    },
  },
  'validation-before-init-blank': {
    source: {
      finding: 'N-01: a row inserted before init() clones the unparsed template and copies existing values (Phase 4B/4C)',
      failure: 'Row inserted before init must be blank.',
    },
    production: {
      finding: 'N-01: a row inserted before init() clones the unparsed template and copies existing values (Phase 4B/4C)',
      failure: 'Row inserted before init must be blank.',
    },
  },
  'validation-per-row-rules': {
    source: {
      finding: 'N-05: validator templates are keyed by field, so the last row\'s rule replaces the others (C09, Phase 4C)',
      failure: 'Each existing row must keep its own rule.',
    },
    production: {
      finding: 'N-05: the 1.0.2 algorithm re-adds the first row\'s rule to every row (C09, Phase 4C)',
      failure: 'Each existing row must keep its own rule.',
    },
  },
  'validation-without-activeform': {
    production: {
      finding: `${staleProduction}; the 1.0.2 algorithm requires ActiveForm data and throws without the client script`,
      failure: "Cannot read properties of undefined (reading 'attributes')",
    },
  },
  'validation-nested': {
    production: {
      finding: 'A-F03: the 1.0.2 algorithm leaves the validator of a deleted nested row (stale validator)',
      failure: 'No stale or duplicate validators.',
    },
  },
  'validation-last-row': {
    production: {
      finding: 'A-F03: deleting the last row leaves its client validator; the minified asset predates the fix',
      failure: 'Deleting the last row must remove its validator.',
    },
  },
};
