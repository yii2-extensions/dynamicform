<?php

declare(strict_types=1);

/**
 * Renders houses containing rooms through an outer and an inner DynamicFormWidget, as in the README nested example.
 *
 * The inner widget is rendered once per house. `sharedButtons` gives both widgets the same insert and delete selectors;
 * `data-test` attributes identify the buttons for the browser tests whatever their classes.
 *
 * @var yii\web\View $this
 * @var array{
 *   name: string,
 *   clientValidation: bool,
 *   houses: list<array{string, list<string>}>,
 *   sharedButtons: bool,
 *   submitUrl: string
 * } $scenario
 */

use yii\widgets\ActiveForm;
use Yii2\Extensions\DynamicForm\DynamicFormWidget;
use Yii2\Extensions\DynamicForm\Tests\Support\FormModel;

$this->title = 'DynamicForm ' . $scenario['name'];
$houses = [];
$rooms = [];

foreach ($scenario['houses'] as $i => [$houseName, $roomNames]) {
    $houses[$i] = new FormModel(['formName' => 'House', 'name' => $houseName]);
    $rooms[$i] = array_map(
        static fn(string $roomName): FormModel => new FormModel(['formName' => 'Room', 'name' => $roomName]),
        $roomNames,
    );
}

$buttons = $scenario['sharedButtons']
    ? ['house' => ['add-item', 'remove-item'], 'room' => ['add-item', 'remove-item']]
    : ['house' => ['add-house', 'remove-house'], 'room' => ['add-room', 'remove-room']];

$form = ActiveForm::begin([
    'id' => 'nested-form',
    'action' => $scenario['submitUrl'],
    'enableClientValidation' => $scenario['clientValidation'],
]);

DynamicFormWidget::begin([
    'widgetContainer' => 'dynamicform_outer',
    'widgetBody' => '.houses',
    'widgetItem' => '.house',
    'limit' => 4,
    'min' => 1,
    'insertButton' => ".{$buttons['house'][0]}",
    'deleteButton' => ".{$buttons['house'][1]}",
    'model' => $houses[0],
    'formId' => 'nested-form',
    'formFields' => ['name'],
]);
?>
<div class="houses">
<?php foreach ($houses as $i => $house): ?>
    <div class="house">
        <?= $form->field($house, "[{$i}]name")->textInput() ?>
        <?php DynamicFormWidget::begin([
            'widgetContainer' => 'dynamicform_inner',
            'widgetBody' => '.rooms',
            'widgetItem' => '.room',
            'limit' => 4,
            'min' => 1,
            'insertButton' => ".{$buttons['room'][0]}",
            'deleteButton' => ".{$buttons['room'][1]}",
            'model' => $rooms[$i][0],
            'formId' => 'nested-form',
            'formFields' => ['name'],
        ]); ?>
        <div class="rooms">
        <?php foreach ($rooms[$i] as $j => $room): ?>
            <div class="room">
                <?= $form->field($room, "[{$i}][{$j}]name")->textInput() ?>
                <button type="button" class="<?= $buttons['room'][1] ?>" data-test="remove-room">Remove room</button>
            </div>
        <?php endforeach; ?>
        </div>
        <button type="button" class="<?= $buttons['room'][0] ?>" data-test="add-room">Add room</button>
        <?php DynamicFormWidget::end(); ?>
        <button type="button" class="<?= $buttons['house'][1] ?>" data-test="remove-house">Remove house</button>
    </div>
<?php endforeach; ?>
</div>
<button type="button" class="<?= $buttons['house'][0] ?>" data-test="add-house">Add house</button>
<?php DynamicFormWidget::end(); ?>
<button type="submit" class="submit">Save</button>
<?php
ActiveForm::end();
