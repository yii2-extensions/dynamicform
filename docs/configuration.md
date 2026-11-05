# Configuration guide

The widget is `Yii2\Extensions\DynamicForm\DynamicFormWidget`, rendered with `begin()` and `end()` around the rows of an
`ActiveForm`. The first element matching `widgetItem` becomes the client template of a row; when `min` is `0`, the
server removes the rendered rows and the form starts empty.

## Widget properties

| Property          | Meaning                                                                                            |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| `widgetContainer` | Class of the container rendered around the rows; alphanumeric characters and `_` only. Required.   |
| `widgetBody`      | CSS selector of the element that holds the rows. Required.                                         |
| `widgetItem`      | CSS selector of one row. Required.                                                                 |
| `limit`           | Maximum number of rows; inserting beyond it triggers `limitReached` instead. Default `999`.        |
| `min`             | Minimum number of rows; `0` starts with an empty body, `1` keeps the first row. Default `1`.       |
| `insertPosition`  | Where new rows are inserted, `bottom` or `top`. Default `bottom`.                                  |
| `insertButton`    | CSS selector of the buttons that insert a row.                                                     |
| `deleteButton`    | CSS selector of the buttons that delete a row.                                                     |
| `model`           | Model of one row, used to build the client template; pass the first element of the rows. Required. |
| `formId`          | `id` of the `ActiveForm`; it must match the form the rows belong to. Required.                     |
| `formFields`      | Attributes of the row model whose client validation is registered for inserted rows. Required.     |

Every option is documented in the PHPDoc of its property in `src/DynamicFormWidget.php`.

## Several widgets on a page

A page registers each widget once per `formId` and `widgetContainer`. A widget rendered again with the same form and
container, such as an inner widget rendered once per outer row, reuses that registration, so it must be configured with
the same options; only its rendered rows may differ. Rendering the same container in the same form with other options
throws `InvalidConfigException` naming the options that differ. Forms are independent: two forms may use the same
container name with different options.

Insert and delete buttons act on the widget whose container holds them most closely, so nested widgets may share button
selectors. Place the buttons of a widget inside its container and outside the containers nested in it.

## Rows

Render one field per attribute with the tabular syntax `[{$i}]attribute`. Keep the hidden primary key of stored rows so
the update action can match them:

```php
<?php if (!$modelAddress->isNewRecord): ?>
    <?= Html::activeHiddenInput($modelAddress, "[{$i}]id") ?>
<?php endif; ?>
<?= $form->field($modelAddress, "[{$i}]full_name")->textInput(['maxlength' => true]) ?>
```

## Server-side models

`Yii2\Extensions\DynamicForm\Models\Model::createMultiple()` returns one model per posted row: it reuses the existing
models whose primary key was posted and creates new ones for the rest. Do not confuse it with `yii\base\Model`.

```php
use Yii;
use Yii2\Extensions\DynamicForm\Models\Model;

$modelsAddress = Model::createMultiple(Address::class, $modelCustomer->addresses, 'id');

Model::loadMultiple($modelsAddress, Yii::$app->request->post());

$valid = Model::validateMultiple($modelsAddress);
```

The third argument names the primary key; it defaults to `id`.

## Enhanced controls

Rows are cloned from the server markup, so a control enhanced on the client needs a marker that survives cloning. Add
`data-tomselect` to the selects that [TomSelect](https://tom-select.js.org/) should initialize in inserted rows; Kartik
widgets are detected through their own `data-krajee-*` attributes.

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
