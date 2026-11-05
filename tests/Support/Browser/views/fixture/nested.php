<?php

declare(strict_types=1);

/**
 * Renders houses containing rooms through an outer and an inner DynamicFormWidget, as in the README nested example.
 *
 * @var yii\web\View $this
 * @var array{name: string, clientValidation: bool, submitUrl: string} $scenario
 */

use yii\widgets\ActiveForm;
use Yii2\Extensions\DynamicForm\DynamicFormWidget;
use Yii2\Extensions\DynamicForm\Tests\Support\FormModel;

$this->title = 'DynamicForm ' . $scenario['name'];
$houses = [new FormModel(['formName' => 'House', 'name' => 'h0'])];
$rooms = [[new FormModel(['formName' => 'Room', 'name' => 'r00'])]];

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
    'insertButton' => '.add-house',
    'deleteButton' => '.remove-house',
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
            'insertButton' => '.add-room',
            'deleteButton' => '.remove-room',
            'model' => $rooms[$i][0],
            'formId' => 'nested-form',
            'formFields' => ['name'],
        ]); ?>
        <div class="rooms">
        <?php foreach ($rooms[$i] as $j => $room): ?>
            <div class="room">
                <?= $form->field($room, "[{$i}][{$j}]name")->textInput() ?>
                <button type="button" class="remove-room">Remove room</button>
            </div>
        <?php endforeach; ?>
        </div>
        <button type="button" class="add-room">Add room</button>
        <?php DynamicFormWidget::end(); ?>
        <button type="button" class="remove-house">Remove house</button>
    </div>
<?php endforeach; ?>
</div>
<button type="button" class="add-house">Add house</button>
<?php DynamicFormWidget::end(); ?>
<button type="submit" class="submit">Save</button>
<?php
ActiveForm::end();
