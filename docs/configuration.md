# Configuration guide

The widget is `Yii2\Extensions\DynamicForm\DynamicFormWidget`, rendered with `begin()` and `end()` around the rows of an
`ActiveForm`. The first element matching `widgetItem` becomes the client template of a row. With integer `min=0`, the
configured `model` controls all rows: if its `isNewRecord` is truthy or absent, the server removes every rendered
`widgetItem`, including markup for persisted siblings. Otherwise all rendered rows remain, including new ones.
Individual row models are not inspected for this decision.

## Widget properties

| Property          | Meaning                                                                                            |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| `widgetContainer` | Class of the container rendered around the rows; alphanumeric characters and `_` only. Required.   |
| `widgetBody`      | CSS selector of the element that holds the rows. Required.                                         |
| `widgetItem`      | CSS selector of one row. Required.                                                                 |
| `limit`           | Maximum number of rows; inserting beyond it triggers `limitReached` instead. Default `999`.        |
| `min`             | Minimum row count for client deletion. Initial removal follows the model state above. Default `1`. |
| `insertPosition`  | Where new rows are inserted, `bottom` or `top`. Default `bottom`.                                  |
| `insertButton`    | Non-empty CSS selector of the buttons that insert a row.                                           |
| `deleteButton`    | Non-empty CSS selector of the buttons that delete a row.                                           |
| `model`           | Model of one row, used to build the client template; pass the first element of the rows. Required. |
| `formId`          | `id` of the `ActiveForm`; it must match the form the rows belong to. Required.                     |
| `formFields`      | Attributes of the row model whose client validation is registered for inserted rows. Required.     |

Every option is documented in the PHPDoc of its property in `src/DynamicFormWidget.php`. The widget does not validate
the types or bounds of `min` and `limit`; the application should supply integers satisfying `0 <= min <= limit`.

Set both button selectors explicitly. They default to `null` and are not validated; null or empty selectors bind the
click handler directly to the form and can prevent unrelated click defaults, including submission. To omit an action,
use a non-empty selector that matches no element. Use `type="button"` on insert and delete controls.

When redisplaying a failed POST with `min=0`, a configured `model` that still counts as new removes all rendered rows
and their errors, even if their models hold submitted values. Preserve that markup through an application-specific
rendering strategy and verify that users can still delete all optional rows. Do not mark an unsaved ActiveRecord as
persisted to bypass this behavior.

## Several widgets on a page

A page registers each widget once per `formId` and `widgetContainer`. A widget rendered again with the same form and
container, such as an inner widget rendered once per outer row, reuses that registration, so it must be configured with
the same options; only its rendered rows may differ. Rendering the same container in the same form with other options
throws `InvalidConfigException` naming the options that differ. Forms are independent: two forms may use the same
container name with different options.

Insert and delete buttons act on the widget whose container holds them most closely, so nested widgets may share button
selectors. Place the buttons of a widget inside its container and outside the containers nested in it. With `min=0`,
keep an insert button outside every `widgetItem` of that widget so it survives initial row removal and deletion of the
last row. A delete button belongs inside the row it deletes.

## Rows

Render one field per attribute with the tabular syntax `[{$i}]attribute`. Keep the hidden primary key of stored rows so
the update action can match them:

```php
<?php if (!$modelAddress->isNewRecord): ?>
    <?= Html::activeHiddenInput($modelAddress, "[{$i}]id") ?>
<?php endif; ?>
<?= $form->field($modelAddress, "[{$i}]full_name")->textInput(['maxlength' => true]) ?>
```

When rows are inserted, deleted or renumbered through `updateContainer`, the plugin rewrites the row indexes in the `id`
and `name` of every element of a row. For each id it changes, it also updates the `label[for]` and the `field-<id>`
container class that match the old id among the elements inside the row. Both are compared with the old id as literal
text, so an id holding characters such as `.`, `:` or a quote is updated like any other, and an element whose classes
only resemble a selector built from that id is left unchanged. The row element itself is not among those elements, so
its class is left unchanged when it is also the field container. The row indexes are located as follows:

- **Row model inputs.** The widget sends one id and name pattern per `formFields` attribute, built from the form name of
  `model`, such as `address-{}-full_name` and `Address[{}][full_name]`. The part before `{}` (`address-`, `Address[`) is
  shared by every input of that model, so an input that starts with it followed by its row indexes is located through it
  even when its attribute is not listed in `formFields`, such as the hidden primary key. The row indexes follow that
  prefix, one per widget the input is nested in; what follows them, numeric keys included, is kept. A literal key in the
  form name of the model, such as `Model[2024]`, belongs to the prefix (`model-2024-`, `Model[2024][`).
- **Other inputs.** An id or name that starts with another model name, such as `Meta[0][5][ts]`, and not with a declared
  prefix has no declared pattern and is renumbered by position: in the first run of numeric segments after the model
  name (`-0-5-` in `meta-0-5-ts`, `[0][5]` in `Meta[0][5][ts]`), the first segments, up to one per widget the input is
  nested in from the outermost, are the row indexes; the remaining segments are literal keys and are kept.
  `Meta[0][5][ts]` in the second row of a widget that is not nested becomes `Meta[1][5][ts]`.
- **Numeric keys before the row index.** Position cannot tell a numeric key in front of the row indexes from an index:
  `Other[2024][0][x]` would have `2024` replaced. Such a key is supported only in the form name of `model`, whose
  declared patterns locate the index after it; there is no option to declare patterns for other models. Conversely, an
  input of another model whose id or name starts with a declared prefix is read as a row model input: when the form name
  of `model` is `Model[0]`, the `5` of `Model[0][5][ts]` is taken for the row index and replaced, even in the first row.
- **Other shapes.** When no declared prefix matches, an id without a numeric segment between two other segments gets the
  row index appended once after a dash (`extra` becomes `extra-0`). A name is kept unless its numeric bracket segments
  are followed by a final bracket segment, as in `Meta[0][ts]`. Ids and names renumbered by position must not hold line
  breaks (line feed, carriage return, U+2028 or U+2029): such a value is handled as one of these other shapes.

Inserted and renumbered rows are validated with the rules `ActiveForm` registered for their field, under the new id. The
`input` and `container` selectors of that registration, including those set through `ActiveField::$selectors`, follow
the id when they name it as is or escaped with backslashes, such as `#address-0-zip\.code` or `[id="address-0-zip"]`; a
selector that does not name the id is replaced by Yii's defaults `#<id>` and `.field-<id>`. Yii's default selectors do
not escape the id, so a validated field whose id holds a period needs escaped `selectors`.

## Server-side models

`Yii2\Extensions\DynamicForm\Models\Model::createMultiple()` returns one model per posted row: it reuses the existing
models whose primary key was posted and creates new ones for the rest. Do not confuse it with `yii\base\Model`. The
following flat-list example assumes the payload checks described below have already passed.

```php
use Yii;
use Yii2\Extensions\DynamicForm\Models\Model;

$modelsAddress = Model::createMultiple(Address::class, $modelCustomer->addresses, 'id');

Model::loadMultiple($modelsAddress, Yii::$app->request->post());

$valid = Model::validateMultiple($modelsAddress);
```

The third argument names the primary key; it defaults to `id`. This example expects a flat list with contiguous
zero-based indexes. `createMultiple()` reindexes its result, while `loadMultiple()` reads the original payload by those
indexes. Reject malformed row shapes and sparse or non-list indexes, or rebuild and load each model explicitly from the
same validated row entry. A successful `loadMultiple()` return does not prove every row was populated.

Enforce minimum and maximum posted row counts on the server before constructing models; widget `min` and `limit` are not
server-side submission validation. `Model::validateMultiple([])` returns `true`, so it does not enforce a required row.
Define the endpoint's policy for an intentionally empty list versus an invalid or missing group.

Authorize the parent and load existing children from its permitted relation. Before calling the helper or loading
attributes, reject non-empty posted keys outside that collection and repeated keys after schema-appropriate
normalization. Unknown keys create new models; repeated keys can reuse one instance. Use an explicit empty-key
convention for new rows rather than treating a valid key such as `0` as empty. Keep primary and parent foreign keys out
of mass assignment and assign the authorized parent on the server. Validate the parent, every row and the counts before
deleting intentionally omitted children or saving, and keep those writes in one transaction with a guarded rollback.

For nested payloads, apply counts and key ownership per parent, then rebuild, load and validate child lists explicitly;
`createMultiple()` neither traverses nested rows nor accepts a separate payload argument. Preserve parent/child index
mapping, authorize posted primary keys against their owning parent, and save the complete hierarchy in the same
transaction.

## Enhanced controls

Rows are cloned from the server markup, so a control enhanced on the client needs a marker that survives cloning. Add
`data-tomselect` to the selects that [TomSelect](https://tom-select.js.org/) should initialize in inserted rows; Kartik
widgets are detected through their own `data-krajee-*` attributes. The library versions and widget layouts the tests
cover are listed in the [testing guide](testing.md#third-party-integrations).

TomSelect notes:

- The selects of inserted rows are initialized with fixed settings: the `remove_button` and `dropdown_input` plugins and
  `allowEmptyOption`. Load a TomSelect build that includes those plugins, such as `tom-select.complete.js`. The settings
  the application gave to the selects of the rendered rows are not copied to inserted rows.
- Rendered selects that the application initialized keep their instance and settings when rows are inserted, deleted or
  renumbered; a renumbered instance takes the ids of its new row.
- The `.item` elements TomSelect renders for selected values are not rows, even when `widgetItem` is `.item`.
- Deleting a row destroys its TomSelect instances.
- A native form reset restores the selects themselves; TomSelect does not update its own display on reset.

## JavaScript events

The container that owns the clicked button triggers jQuery events when rows are inserted or deleted; containers of other
widgets, including other renderings of a nested widget, are not notified. `beforeInsert` receives the clicked button and
cannot cancel the insertion. Returning `false` from `beforeDelete` cancels the deletion.

```javascript
$(".dynamicform_wrapper").on("beforeInsert", function (e, item) {
    console.log("beforeInsert");
});

$(".dynamicform_wrapper").on("afterInsert", function (e, item) {
    console.log("afterInsert");
});

$(".dynamicform_wrapper").on("beforeDelete", function (e, item) {
    if (!confirm("Are you sure you want to delete this item?")) {
        return false;
    }

    return true;
});

$(".dynamicform_wrapper").on("afterDelete", function (e) {
    console.log("Deleted item!");
});

$(".dynamicform_wrapper").on("limitReached", function (e, item) {
    alert("Limit reached");
});
```

[Back to documentation](../README.md#documentation)
