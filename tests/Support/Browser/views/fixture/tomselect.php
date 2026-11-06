<?php

declare(strict_types=1);

/**
 * Renders real TomSelect 2.4.3 controls inside DynamicFormWidget rows, next to Kartik Select2 and plain selects.
 *
 * The page initializes TomSelect on the selects marked with `data-tomselect` on DOM ready, as an application does, with
 * its own settings per marker value; DynamicForm initializes the marked selects of inserted rows. Three forms:
 *
 * - `tomselect-form`: rows `.item` wrapped in card markup, two stored rows (`Item[<i>][...]`), `min` 1, `limit` 4.
 * - `table-form`: rows are `tr.item` in the `tbody` of `table.container-rows` (the shape of issue #6), posted under
 *   `Row[2024][<i>][Sales][...]`, inserted at the top, `min` 0, `limit` 3.
 * - `nested-form`: houses (`.house`) holding rooms (`.item`) with a multiple TomSelect.
 *
 * @var yii\web\View $this
 * @var array{name: string, submitUrl: string} $scenario
 */

use kartik\select2\Select2;
use yii\helpers\Html;
use yii\web\View;
use yii\widgets\ActiveForm;
use Yii2\Extensions\DynamicForm\DynamicFormWidget;
use Yii2\Extensions\DynamicForm\Tests\Support\Browser\TomSelectAsset;
use Yii2\Extensions\DynamicForm\Tests\Support\FormModel;
use Yii2\Extensions\DynamicForm\Tests\Support\TomSelectFormModel;

$this->title = 'DynamicForm ' . $scenario['name'];

TomSelectAsset::register($this);

$kinds = ['k1' => 'Kind one', 'k2' => 'Kind two', 'k3' => 'Kind three'];
$tags = ['Warm' => ['t1' => 'Red', 't2' => 'Orange'], 'Cold' => ['t3' => 'Blue', 't4' => 'Green']];
$colors = ['red' => 'Red', 'blue' => 'Blue'];

// Application code: TomSelect settings per `data-tomselect` value, applied to the rendered selects on DOM ready. The
// listbox of `kind` is mounted in the body, outside its row.
$this->registerJs(
    <<<'JS'
        window.tomSelectSettings = {
            kind: { plugins: ['clear_button'], allowEmptyOption: true, maxOptions: 20, dropdownParent: 'body' },
            tags: { plugins: ['remove_button'], maxItems: 3 },
        };
        document.querySelectorAll('select[data-tomselect]').forEach(function (select) {
            new TomSelect(select, window.tomSelectSettings[select.getAttribute('data-tomselect')]);
        });
        JS,
    View::POS_READY,
);

$stored = static fn(string $formName, array $values): TomSelectFormModel => new TomSelectFormModel(
    ['formName' => $formName] + $values,
);

$buttons = '<button type="button" class="add-item">Add</button>'
    . '<button type="button" class="remove-item">Remove</button>';

$form = ActiveForm::begin(['id' => 'tomselect-form', 'action' => $scenario['submitUrl']]);

$items = [
    $stored('Item', ['id' => 1, 'name' => 'n0', 'kind' => 'k1', 'tags' => ['t1', 't3'], 'color' => 'red', 'level' => 'l1']),
    $stored('Item', ['id' => 2, 'name' => 'n1', 'kind' => 'k2', 'tags' => ['t2'], 'color' => 'blue', 'level' => 'l2']),
];

DynamicFormWidget::begin(
    [
        'widgetContainer' => 'dynamicform_items',
        'widgetBody' => '.container-items',
        'widgetItem' => '.item',
        'limit' => 4,
        'min' => 1,
        'insertButton' => '.add-item',
        'deleteButton' => '.remove-item',
        'model' => $items[0],
        'formId' => 'tomselect-form',
        'formFields' => ['name', 'kind', 'tags', 'color', 'level'],
    ],
);

echo '<div class="container-items">';

foreach ($items as $i => $item) {
    echo '<div class="item"><div class="card"><div class="card-body">'
        . Html::activeHiddenInput($item, "[{$i}]id")
        . $form->field($item, "[{$i}]name")->textInput()
        . $form->field($item, "[{$i}]kind")->dropDownList($kinds, ['prompt' => 'Select kind', 'data-tomselect' => 'kind'])
        . $form->field($item, "[{$i}]tags")->dropDownList($tags, ['multiple' => true, 'data-tomselect' => 'tags'])
        . $form->field($item, "[{$i}]color")->dropDownList($colors, ['prompt' => 'Select color'])
        . $form->field($item, "[{$i}]level")->widget(
            Select2::class,
            ['data' => ['l1' => 'Low', 'l2' => 'High'], 'options' => ['placeholder' => 'Select level']],
        )
        . $buttons
        . '</div></div></div>';
}

echo '</div><button type="button" class="add-item add-first">Add</button>';

DynamicFormWidget::end();

echo Html::dropDownList('filter', null, $colors, ['id' => 'outside-filter', 'prompt' => 'Any color']);
echo '<button type="submit" class="submit">Save</button>';

ActiveForm::end();

$form = ActiveForm::begin(['id' => 'table-form', 'action' => $scenario['submitUrl']]);

$row = $stored('Row[2024]', ['id' => 7, 'kind' => 'k3', 'tags' => ['t4']]);

DynamicFormWidget::begin(
    [
        'widgetContainer' => 'dynamicform_table',
        'widgetBody' => '.container-rows',
        'widgetItem' => '.item',
        'insertPosition' => 'top',
        'limit' => 3,
        'min' => 0,
        'insertButton' => '.add-item',
        'deleteButton' => '.remove-item',
        'model' => $row,
        'formId' => 'table-form',
        'formFields' => ['[Sales]kind', '[Sales]tags'],
    ],
);

echo '<table class="container-rows"><tbody><tr class="item"><td>'
    . $form->field($row, '[0][Sales]kind')->dropDownList($kinds, ['prompt' => 'Select kind', 'data-tomselect' => 'kind'])
    . '</td><td>'
    . $form->field($row, '[0][Sales]tags')->dropDownList($tags, ['multiple' => true, 'data-tomselect' => 'tags'])
    . '</td><td>'
    . $buttons
    . '</td></tr></tbody></table><button type="button" class="add-item add-first">Add</button>';

DynamicFormWidget::end();

echo '<button type="submit" class="submit">Save</button>';

ActiveForm::end();

$form = ActiveForm::begin(['id' => 'nested-form', 'action' => $scenario['submitUrl']]);

$house = new FormModel(['formName' => 'House', 'name' => 'h0']);
$room = $stored('Room', ['name' => 'r00', 'tags' => ['t3']]);

DynamicFormWidget::begin(
    [
        'widgetContainer' => 'dynamicform_houses',
        'widgetBody' => '.houses',
        'widgetItem' => '.house',
        'limit' => 3,
        'min' => 1,
        'insertButton' => '.add-house',
        'deleteButton' => '.remove-house',
        'model' => $house,
        'formId' => 'nested-form',
        'formFields' => ['name'],
    ],
);

echo '<div class="houses"><div class="house">', $form->field($house, '[0]name')->textInput();

DynamicFormWidget::begin(
    [
        'widgetContainer' => 'dynamicform_rooms',
        'widgetBody' => '.rooms',
        'widgetItem' => '.item',
        'limit' => 3,
        'min' => 1,
        'insertButton' => '.add-room',
        'deleteButton' => '.remove-room',
        'model' => $room,
        'formId' => 'nested-form',
        'formFields' => ['name', 'tags'],
    ],
);

echo '<div class="rooms"><div class="item">'
    . $form->field($room, '[0][0]name')->textInput()
    . $form->field($room, '[0][0]tags')->dropDownList($tags, ['multiple' => true, 'data-tomselect' => 'tags'])
    . '<button type="button" class="remove-room">Remove room</button>'
    . '</div></div><button type="button" class="add-room">Add room</button>';

DynamicFormWidget::end();

echo '<button type="button" class="remove-house">Remove house</button></div></div>'
    . '<button type="button" class="add-house">Add house</button>';

DynamicFormWidget::end();

echo '<button type="submit" class="submit">Save</button>';

ActiveForm::end();
