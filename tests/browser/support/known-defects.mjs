// Known pre-fix failures, keyed by test id and asset variant ("source" or "production").
//
// Each reason names the finding (F-xx: adjudicated review finding) and the phase that owns the fix. An entry only turns
// the listed variant into an expected failure; Playwright fails the run if that case unexpectedly passes, so remove the
// entry together with the fix. `pageErrors` lists exact uncaught error messages that are themselves the defect; any
// other page issue still fails the run. Do not add entries to hide fixture errors or unexplained failures.
export const knownDefects = {
  'rendered-insert-delete': { variants: {} },
  'rendered-payload': { variants: {} },
  'rendered-required-rule': { variants: {} },
  'rendered-no-validation': { variants: {} },
  'rendered-zero-start': { variants: {} },
  'rendered-numeric-literal-key': { variants: {} },
  'rendered-preload-blank': { variants: {} },
  'rendered-preload-validation': { variants: {} },
  'rendered-last-row': { variants: {} },
  'rendered-nested-payload': { variants: {} },
  'rendered-nested-validation': { variants: {} },
  'rendered-before-insert-owner': { variants: {} },
  'rendered-nested-repeated': { variants: {} },
  'rendered-nested-shared-buttons': { variants: {} },
  'rendered-two-forms': { variants: {} },
  'rendered-two-forms-validators': { variants: {} },
  'rendered-two-forms-same-container': { variants: {} },
  'rendered-quoted-selector': { variants: {} },
  'rendered-special-form-id': { variants: {} },
};
