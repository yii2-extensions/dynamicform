<?php

declare(strict_types=1);

/**
 * Renders Kartik DatePicker controls (bootstrap-datepicker as `kvDatepicker`) inside DynamicFormWidget rows.
 *
 * DatePicker stores its client options in a page variable named by `data-krajee-kvdatepicker` on the input, and
 * initializes the element `data-datepicker-source` names: the `.input-group.date` container of a component type, or
 * the input itself for `TYPE_INPUT`. Three forms:
 *
 * - `datepicker-form`: two stored rows (`Task[<i>][...]`) with `date` (default prepended component with a remove
 *   button), `due` (`TYPE_INPUT`) and `start` (`TYPE_INLINE`, whose container carries the date in `data-date`),
 *   `min` 1, `limit` 4, plus an appended component outside the rows.
 * - `zero-form`: a new model with `min` 0, so the server renders no row (`Line[<i>][date]`).
 * - `nested-form`: houses (`.house`) holding rooms (`.item`) with a `date` component.
 *
 * Calendars of blank controls open on January 2026, so a click on a day selects the same date on every run.
 *
 * @var yii\web\View $this
 * @var array{name: string, submitUrl: string} $scenario
 */

use kartik\date\DatePicker;
use yii\helpers\Html;
use yii\widgets\ActiveForm;
use Yii2\Extensions\DynamicForm\DynamicFormWidget;
use Yii2\Extensions\DynamicForm\Tests\Support\{DatePickerFormModel, FormModel};

$this->title = 'DynamicForm ' . $scenario['name'];

$pluginOptions = ['format' => 'yyyy-mm-dd', 'autoclose' => true, 'defaultViewDate' => ['year' => 2026, 'month' => 0]];
$date = ['pluginOptions' => $pluginOptions];
$due = ['type' => DatePicker::TYPE_INPUT, 'pluginOptions' => ['todayHighlight' => true] + $pluginOptions];
$start = ['type' => DatePicker::TYPE_INLINE, 'pluginOptions' => $pluginOptions];

$stored = static fn(string $formName, array $values): DatePickerFormModel => new DatePickerFormModel(
    ['formName' => $formName] + $values,
);

$buttons = '<button type="button" class="add-item">Add</button>'
    . '<button type="button" class="remove-item">Remove</button>';

$form = ActiveForm::begin(['id' => 'datepicker-form', 'action' => $scenario['submitUrl']]);

$tasks = [
    $stored('Task', ['id' => 1, 'name' => 'n0', 'date' => '2025-03-10', 'due' => '2025-04-01', 'start' => '2025-02-03']),
    $stored('Task', ['id' => 2, 'name' => 'n1', 'date' => '2025-05-20', 'due' => '2025-06-02', 'start' => '2025-05-04']),
];

DynamicFormWidget::begin(
    [
        'widgetContainer' => 'dynamicform_tasks',
        'widgetBody' => '.container-items',
        'widgetItem' => '.item',
        'limit' => 4,
        'min' => 1,
        'insertButton' => '.add-item',
        'deleteButton' => '.remove-item',
        'model' => $tasks[0],
        'formId' => 'datepicker-form',
        'formFields' => ['name', 'date', 'due', 'start'],
    ],
);

echo '<div class="container-items">';

foreach ($tasks as $i => $task) {
    echo '<div class="item">'
        . Html::activeHiddenInput($task, "[{$i}]id")
        . $form->field($task, "[{$i}]name")->textInput()
        . $form->field($task, "[{$i}]date")->widget(DatePicker::class, $date)
        . $form->field($task, "[{$i}]due")->widget(DatePicker::class, $due)
        . $form->field($task, "[{$i}]start")->widget(DatePicker::class, $start)
        . $buttons
        . '</div>';
}

echo '</div><button type="button" class="add-item add-first">Add</button>';

DynamicFormWidget::end();

echo DatePicker::widget(
    ['name' => 'outside', 'id' => 'outside-date', 'value' => '2025-12-24', 'type' => DatePicker::TYPE_COMPONENT_APPEND]
    + $date,
);
echo '<button type="submit" class="submit">Save</button>';

ActiveForm::end();

$form = ActiveForm::begin(['id' => 'zero-form', 'action' => $scenario['submitUrl']]);

$line = $stored('Line', ['isNewRecord' => true]);

DynamicFormWidget::begin(
    [
        'widgetContainer' => 'dynamicform_lines',
        'widgetBody' => '.container-lines',
        'widgetItem' => '.item',
        'limit' => 3,
        'min' => 0,
        'insertButton' => '.add-item',
        'deleteButton' => '.remove-item',
        'model' => $line,
        'formId' => 'zero-form',
        'formFields' => ['date'],
    ],
);

echo '<div class="container-lines"><div class="item">'
    . $form->field($line, '[0]date')->widget(DatePicker::class, $date)
    . $buttons
    . '</div></div><button type="button" class="add-item add-first">Add</button>';

DynamicFormWidget::end();

echo '<button type="submit" class="submit">Save</button>';

ActiveForm::end();

$form = ActiveForm::begin(['id' => 'nested-form', 'action' => $scenario['submitUrl']]);

$house = new FormModel(['formName' => 'House', 'name' => 'h0']);
$room = $stored('Room', ['name' => 'r00', 'date' => '2025-07-07']);

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
        'formFields' => ['name', 'date'],
    ],
);

echo '<div class="rooms"><div class="item">'
    . $form->field($room, '[0][0]name')->textInput()
    . $form->field($room, '[0][0]date')->widget(DatePicker::class, $date)
    . '<button type="button" class="remove-room">Remove room</button>'
    . '</div></div><button type="button" class="add-room">Add room</button>';

DynamicFormWidget::end();

echo '<button type="button" class="remove-house">Remove house</button></div></div>'
    . '<button type="button" class="add-house">Add house</button>';

DynamicFormWidget::end();

echo '<button type="submit" class="submit">Save</button>';

ActiveForm::end();
