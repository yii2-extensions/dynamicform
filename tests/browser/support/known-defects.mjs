// Known pre-fix failures, keyed by test id and asset variant ("source" or "production").
//
// Each reason names the finding (F-xx: adjudicated review finding) and the phase that owns the fix. An entry only turns
// the listed variant into an expected failure; Playwright fails the run if that case unexpectedly passes, so remove the
// entry together with the fix. `pageErrors` lists exact uncaught error messages that are themselves the defect; any
// other page issue still fails the run. Do not add entries to hide fixture errors or unexplained failures.
const ownerTarget =
  'F-11: the PHP insert handler triggers beforeInsert on every container with the class, not on the owner (Phase 3C)';
const quotedSelector =
  'F-12: PHP interpolates the selector into a double-quoted JavaScript literal, so the inline handler script is invalid (Phase 3C)';

export const knownDefects = {
  'rendered-insert-delete': { variants: {} },
  'rendered-payload': { variants: {} },
  'rendered-required-rule': { variants: {} },
  'rendered-no-validation': { variants: {} },
  'rendered-zero-start': { variants: {} },
  'rendered-preload-blank': { variants: {} },
  'rendered-preload-validation': { variants: {} },
  'rendered-last-row': { variants: {} },
  'rendered-nested-payload': { variants: {} },
  'rendered-nested-validation': { variants: {} },
  'rendered-before-insert-owner': { variants: { source: ownerTarget, production: ownerTarget } },
  'rendered-two-forms': { variants: {} },
  'rendered-two-forms-validators': { variants: {} },
  'rendered-quoted-selector': {
    variants: { source: quotedSelector, production: quotedSelector },
    pageErrors: { source: ['missing ) after argument list'], production: ['missing ) after argument list'] },
  },
};
