---
name: yii2-dynamicform
description: Use when adding or removing dynamic form rows, cloning or nesting ActiveForm fields, validating or debugging DynamicFormWidget and Model::createMultiple(), or migrating from wbraganca/yii2-dynamicform to yii2-extensions/dynamicform.
license: BSD-3-Clause
---

# Repeatable form rows with yii2-dynamicform

Use `Yii2\Extensions\DynamicForm\DynamicFormWidget` for the rows in the view and
`Yii2\Extensions\DynamicForm\Models\Model::createMultiple()` for the posted rows. Use this package's namespace, not
`wbraganca\dynamicform`. Option names overlap with the original `wbraganca/yii2-dynamicform`; verify their semantics and
validation against this package's PHPDoc and the application's installed revision, rather than assuming fork parity.

## Read the relevant contract

In a root package checkout, use `composer show --self --format=json` for metadata. For installed dependencies, resolve
the real path and read the configured vendor directory's `composer/installed.php` (`versions[<package>]`):
`install_path`, `pretty_version` and Composer's selected `reference`. Do not blindly prefer `source.reference` over
`dist.reference`. For any live package checkout, including a symlinked path install, inspect its current `HEAD` and
files even when clean; report metadata mismatches and let the actual files govern. Uncommitted changes have no matching
SHA. Otherwise use the selected reference or a verified matching tag only after establishing its source provenance.
Compare `composer.lock`; it may differ from the inspected installation.

The package archive ships `README.md`, `CHANGELOG.md`, `src/` and this skill, but not the `docs/` guides. Read them from
a checkout, or from `https://github.com/yii2-extensions/dynamicform/blob/<verified-reference>/docs/<guide>.md` after
verifying the reference: `installation.md`, `configuration.md` (properties, row identity, validation selectors,
integrations, events), `examples.md` (create, update and view) and `testing.md` (tested library versions). There is no
hosted documentation site for this package. If the guides are unavailable or offline, use the PHPDoc of
`src/DynamicFormWidget.php`, `src/Models/Model.php`, the plugin `src/assets/yii2-dynamic-form.js` and the changelog, and
report the gap.

## Install

The package requires PHP 8.3 or higher with `dom`, `yiisoft/yii2` `^2.0.55 || ^22.0` and Symfony `css-selector` and
`dom-crawler` 6.4 or 7.x. The Yii 22 line needs an explicit `yiisoft/yii2:22.0.x-dev` requirement in the application.
Install with `composer require yii2-extensions/dynamicform:^2.0`.

`DynamicFormAsset` depends on `yii\web\JqueryAsset` and `yii\widgets\ActiveFormAsset`. On Yii 22, also install
`yiisoft/yii2-jquery:dev-master` and register `\yii\jquery\Bootstrap::class` in the application's `bootstrap` list;
without that client-script implementation, registering assets does not enable `ActiveForm` client validation. Provide
jQuery at the path expected by `JqueryAsset`: `@bower/jquery/dist` on Yii 2.0.55, `@npm/jquery/dist` on Yii 22, or a
deliberate bundle override. No Node.js build is needed for the widget. `YII_DEBUG=false` loads
`yii2-dynamic-form.min.js`; preserve any `assetManager.bundles` override.

## Render the rows

Wrap the rows of one `ActiveForm` with `DynamicFormWidget::begin()` and `end()`. Required: `widgetContainer` (letters,
digits and `_` only), `widgetBody`, `widgetItem`, `model`, `formId` (the `id` of that form) and `formFields`. Optional:
`limit` (default 999), `min` (default 1) and `insertPosition` (`bottom` or `top`). Set both `insertButton` and
`deleteButton` to non-empty CSS selectors. They default to `null` and are not validated: a null or empty selector binds
the click handler directly to the form and can prevent unrelated click defaults, including submission. To omit an
action, use a non-empty selector that matches no element rather than leaving it null or empty. Missing required options
and invalid `widgetContainer` or `insertPosition` values throw `yii\base\InvalidConfigException`. Validate `min` and
`limit` as integers with `0 <= min <= limit` in the application; the widget does not enforce their types or bounds.

With integer `min=0`, the configured `model` controls the entire rendering: if its `isNewRecord` is truthy or the
property is absent, every rendered `widgetItem` is removed, including markup for any persisted sibling rows. Otherwise
all rendered rows remain, including new ones. The widget does not inspect each row model separately. If the configured
model still counts as new when redisplaying a failed POST, this also removes submitted rows and their rendered errors.
If requiring at least one row is acceptable, use `min=1` consistently on the client and server to retain failed-POST
rows. This does not meet an optional zero-row requirement: the current API has no separate option for preserving new
rows while allowing deletion to zero. Flag that limitation before implementing such a form. Do not mark an unsaved
ActiveRecord as persisted to bypass it.

- Render one element per row matching `widgetItem` inside `widgetBody`; the first one becomes the client template, so
  pass a non-empty list of row models, such as `[new Address()]` for a create form, and its first element as `model`.
- Use tabular attributes, `$form->field($row, "[{$i}]attribute")`. Render the primary key of stored rows as a hidden
  input, `Html::activeHiddenInput($row, "[{$i}]id")`, so the update action can match them.
- List in `formFields` every attribute of the row model whose client validation inserted rows need.
- Place the insert and delete buttons of a widget inside its container and outside the containers nested in it. With
  `min=0`, keep an insert button outside every `widgetItem` of that widget, so it survives initial row removal and
  deletion of the last row. Keep each delete button inside the row it deletes. Use `type="button"` for both controls.

Nested widgets render the inner widget inside each outer row with tabular names `"[{$i}][{$j}]attribute"`, a distinct
`widgetContainer` and identical options in every outer row; only the rendered rows may differ. Rendering the same
container in the same form with other options throws `InvalidConfigException` naming the differing options. Two forms
may reuse a container name with different options. The `min=0` rendering rule also applies to each inner widget: a new
configured model removes its persisted child markup too. Do not interpret that omission as an authorized deletion. When
the outer template contains inner rows, cloning it retains the first inner row even when the inner `min` is zero.

## Handle the posted rows

For a flat list, validate the payload before calling either helper. The
[guarded create and update examples](../../docs/examples.md#request-checks) show one complete application policy; follow
the revision routing above if `docs/` is not installed. Never use this sequence alone on unchecked input:

```php
$models = Model::createMultiple(Address::class, $customer->addresses, 'id');
Model::loadMultiple($models, Yii::$app->request->post());
$valid = Model::validateMultiple($models);
```

`createMultiple($modelClass, $multipleModels = [], $pk = 'id')` reads `Yii::$app->request->post()` under the form name
of `$modelClass`, keeps the posted order, reuses the given models whose key was posted and creates new ones for the
rest. It does not load attributes, enforce row counts, or authorize keys. Before constructing models, enforce the
application's minimum and maximum posted row counts on the server, including per-parent limits for nested lists. Widget
`min`/`limit` are not server-side submission validation. `Model::validateMultiple([])` returns `true` and does not
establish a minimum count. Define how the endpoint distinguishes an intentionally empty list from an invalid or missing
group.

Authorize the parent first and obtain existing children from its permitted relation. Validate posted keys before
`createMultiple()` or loading attributes: reject non-empty keys outside that collection and repeated keys, using the
schema's key normalization. The helper treats unknown keys as new rows and can reuse the same instance for repeated
keys, so it does not reject either case. Use an explicit empty-key convention for new rows; do not treat a valid key
such as `0` as empty. Keep primary and parent foreign keys out of mass assignment; select existing records by their
validated keys and assign the authorized parent on the server. Use a signed snapshot of the originally rendered child
IDs, bound to the authorized parent, to reject stale membership before calculating deletions. Delete only IDs from that
validated snapshot, so later additions cannot become omissions; scope deletion to the parent too. Preserve the original
snapshot after validation errors. The example does not detect concurrent edits to existing values; use a version check
covering all writers when that is required. Only after the parent, all rows and counts pass validation, delete
intentionally omitted stored children and save the remaining rows inside one transaction with a guarded rollback. A
hidden key is user input, not authorization.

The flat flow requires contiguous zero-based row indexes. `createMultiple()` returns a reindexed list, whereas
`loadMultiple()` uses those indexes against the original payload; sparse indexes can leave rows empty or load the wrong
row even when loading returns `true`. Reject malformed row shapes and sparse or non-list indexes before this flow, or
rebuild and load each model explicitly from the same validated row entry. Authorize by primary key, not row number.

For nested names such as `Option[i][j][attribute]`, rebuild each child list explicitly from the corresponding parent
entry in the posted array. `createMultiple()` only iterates the first level under the form name; it neither traverses
nested rows nor accepts a separate payload argument. Reuse or create, load and validate child models per parent,
preserving the posted parent/child index mapping. Authorize each child key against its owning parent and save the
complete hierarchy in the same transaction. Do not apply the flat example to a nested payload or treat a successful
`loadMultiple()` return as proof that leaf attributes were loaded.

## Client behavior

The plugin rewrites row indexes in `id` and `name` on insertion, deletion and `updateContainer`, together with matching
`label[for]` and `field-<id>` classes inside the row. Inputs of the row model are located through the patterns built
from `formFields` and the form name of `model`; other inputs are renumbered by position. A numeric literal key before
the row index is supported only in the form name of `model`. Positional ids and names must not contain line breaks.

Inserted and renumbered rows reuse the client rules ActiveForm registered for their field. Custom
`ActiveField::$selectors` follow the new id when they name it, as is or backslash-escaped, and still select exactly the
field or one container containing it inside its form. Otherwise, including stale row-name constraints, the plugin uses
`#<id>` or `.field-<id>` with the id escaped. The initial Yii registration still needs escaped selectors for ids holding
a period; an id holding an apostrophe stops `yii.activeForm` itself.

Events are triggered on the container that owns the clicked button: `beforeInsert` (informational, cannot cancel),
`afterInsert`, `beforeDelete` (return `false` to cancel), `afterDelete` and `limitReached`. Bind them with
`$('.<widgetContainer>').on(...)`. After the application moves or appends rows outside the buttons, call
`$('.<widgetContainer>').yiiDynamicForm('updateContainer')`. The jQuery methods `init`, `addItem`, `deleteItem` and
`updateContainer` are the plugin API; do not call its private helpers.

## Enhanced controls

Tested versions are listed in `testing.md`: Select2 4.0.13 with Kartik Select2 2.2.5 and DepDrop 1.0.6, TomSelect 2.4.3,
Inputmask 5.0.10 through `yii\widgets\MaskedInput`, Kartik DatePicker 1.4.8 as a component, `TYPE_INPUT` and
`TYPE_INLINE`, and, in jsdom only, Kartik TimePicker 1.0.5, FileInput 1.1.1, TouchSpin 1.2.4, MaskMoney 1.2.3 and
NumberControl 1.0.5. Mark TomSelect selects with `data-tomselect` and load a build with the `remove_button` and
`dropdown_input` plugins; inserted rows get those fixed settings, not the settings of the rendered rows. Other versions,
DatePicker `TYPE_BUTTON`/`TYPE_RANGE` and DepDrop inside nested widgets are untested, and Kartik ColorInput (Spectrum)
is not handled; state that instead of claiming support. Inputmask keeps the form handlers of deleted rows bound, and
with `YII_DEBUG=false` Kartik's `depdrop.min.js` does not run its Select2 loading handling.

## Verify the integration

Exercise a real browser: insert at the limit, delete down to `min`, delete the first row and submit; check that the
posted names are contiguous, that inserted rows are blank and validated, and that stored rows keep their values and
keys. Check that zero rows still leave an insert button, unrelated submit buttons work, and failed POSTs retain rows and
errors. On a disposable application fixture, submit over-limit, missing and malformed payloads, plus foreign and
duplicate primary keys, and verify the endpoint rejects invalid requests before any writes. Repeat with
`YII_DEBUG=false` for the minified asset and with every nested level in use. Count event callbacks and enhanced-control
instances after several cycles to detect duplicates. The package's own browser tests run on Chromium with Yii 2.0.55;
report other browsers, Yii 22 client behavior and untested integrations as unverified.
