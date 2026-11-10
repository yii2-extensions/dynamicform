# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 1.0.3 Under development

- chore: isolate quality tools, add PHP-rendered browser and compatibility tests, and align repository config with the template.
- fix: scope widget registration per page, form and container, and route encoded click handlers and events to the owning container.
- fix: preserve numeric literal keys around the row index by locating the index from the field patterns the widget declares.
- fix: clear the reset defaults of cloned controls, so a native form reset leaves inserted rows blank instead of refilling template values.
- fix: reject `widgetContainer` names with a trailing line feed, so only ASCII letters, digits and underscores are accepted.
- fix: keep Kartik Select2 and DepDrop instances, options and listeners per row across insertion, deletion and renumbering.
- fix: count only widget rows next to TomSelect `.item` elements, keep renumbered TomSelect ARIA ids per row and destroy instances of deleted rows.
- fix: keep Inputmask instances and their options in existing rows instead of masking them again on every insertion and deletion.
- fix: initialize Kartik DatePicker controls of inserted rows on their own element, keep existing instances and release deleted inline calendars.
- test: cover validator templates of rows the server did not render and reuse `_escapeRegExp()` to match them, dropping an unreachable pattern.
- test: cover validator keys and registration of prefixed, undeclared and application-removed row fields, dropping three unreachable checks.
- test: cover ID and name rewriting via regex fallback for inputs with an undeclared model prefix across insert, delete and reorder.
- test: cover `updateContainer` on rows reordered or appended by the application, `init` on the container, non-tabular IDs and name suffixes.
- test: cover the enclosing form taking priority over `formId` and undeclared fields with two indexes in three-level nested rows.
- fix: skip foreign elements sharing the container class in `init` so a misplaced element does not throw and block subsequent POS_LOAD scripts.
- test: cover literal keys after the row index of undeclared fields and `init` on an ancestor with a foreign container, documenting the fallback.
- fix: compare old ids literally when renumbering `field-<id>` classes and `label[for]`, so ids with `.`, `:` or quotes neither throw nor stay stale.
- test: cover DepDrop parameters outside the rows whose id has no numeric segment and DepDrops of another model depending on row inputs.
- test: cover `init` validating `model` and `formFields` before the `initOptions()` hook and a `null` record state keeping rows at zero minimum.

## 1.0.2 May 20, 2026

- fix: initialize `TomSelect` on inserted rows without duplicating instances that are already initialized.

## 1.0.1 August 19, 2024

- fix: allow `Model::createMultiple()` to reuse models whose primary key is not named `id` (#2).
- docs: fix the image path and a minor error in `README.md` (#1).

## 1.0.0 January 31, 2024

- feat: initial release, ported from `wbraganca/yii2-dynamicform`.
