<?php

declare(strict_types=1);

/**
 * Renders two forms on one page, each with its own DynamicFormWidget container and model.
 *
 * @var yii\web\View $this
 * @var array{name: string, clientValidation: bool, submitUrl: string} $scenario
 */

use yii\widgets\ActiveForm;
use Yii2\Extensions\DynamicForm\DynamicFormWidget;
use Yii2\Extensions\DynamicForm\Tests\Support\FormModel;

$this->title = 'DynamicForm ' . $scenario['name'];

$forms = [
    'form-a' => ['dynamicform_a', [new FormModel(['name' => 'a0'])]],
    'form-b' => [
        'dynamicform_b',
        [new FormModel(['formName' => 'House', 'name' => 'b0']), new FormModel(['formName' => 'House', 'name' => 'b1'])],
    ],
];

foreach ($forms as $formId => [$container, $models]) {
    $form = ActiveForm::begin([
        'id' => $formId,
        'action' => $scenario['submitUrl'],
        'enableClientValidation' => $scenario['clientValidation'],
    ]);

    DynamicFormWidget::begin([
        'widgetContainer' => $container,
        'widgetBody' => '.items',
        'widgetItem' => '.item',
        'limit' => 4,
        'min' => 1,
        'insertButton' => '.add-item',
        'deleteButton' => '.remove-item',
        'model' => $models[0],
        'formId' => $formId,
        'formFields' => ['name'],
    ]);

    echo '<div class="items">';

    foreach ($models as $i => $model) {
        echo '<div class="item">', $form->field($model, "[{$i}]name")->textInput(),
        '<button type="button" class="add-item">Add</button>',
        '<button type="button" class="remove-item">Remove</button></div>';
    }

    echo '</div>';

    DynamicFormWidget::end();

    echo '<button type="submit" class="submit">Save</button>';

    ActiveForm::end();
}
