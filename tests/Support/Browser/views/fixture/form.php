<?php

declare(strict_types=1);

/**
 * Renders a tabular form through ActiveForm and DynamicFormWidget::begin()/end().
 *
 * @var yii\web\View $this
 * @var array{
 *   name: string,
 *   clientValidation: bool,
 *   min: int,
 *   persisted: bool,
 *   loadGate: bool,
 *   insertButton: string,
 *   submitUrl: string
 * } $scenario
 */

use yii\helpers\Html;
use yii\widgets\ActiveForm;
use Yii2\Extensions\DynamicForm\DynamicFormWidget;
use Yii2\Extensions\DynamicForm\Tests\Support\{FormModel, PersistedFormModel};

$this->title = 'DynamicForm ' . $scenario['name'];
// A stored row, or a new model whose empty row the server removes when min is 0.
$models = [
    $scenario['persisted'] ? new PersistedFormModel(['id' => 1, 'name' => 'Saved', 'code' => 'A1']) : new FormModel(),
];

$form = ActiveForm::begin([
    'id' => 'dynamic-form',
    'action' => $scenario['submitUrl'],
    'enableClientValidation' => $scenario['clientValidation'],
]);

DynamicFormWidget::begin([
    'widgetContainer' => 'dynamicform_wrapper',
    'widgetBody' => '.container-items',
    'widgetItem' => '.item',
    'limit' => 4,
    'min' => $scenario['min'],
    'insertButton' => $scenario['insertButton'],
    'deleteButton' => '.remove-item',
    'model' => $models[0],
    'formId' => 'dynamic-form',
    'formFields' => ['name', 'code'],
]);
?>
<div class="container-items">
<?php foreach ($models as $i => $model): ?>
    <div class="item">
        <?php if ($scenario['persisted']): ?>
            <?= Html::activeHiddenInput($model, "[{$i}]id") ?>
        <?php endif; ?>
        <?= $form->field($model, "[{$i}]name")->textInput() ?>
        <?= $form->field($model, "[{$i}]code")->textInput() ?>
        <button type="button" class="add-item" data-role="add">Add row</button>
        <button type="button" class="remove-item">Remove row</button>
    </div>
<?php endforeach; ?>
</div>
<button type="button" class="add-item add-first">Add row</button>
<?php
DynamicFormWidget::end();
?>
<button type="submit" class="submit">Save</button>
<?php if ($scenario['loadGate']): ?>
    <img src="/load-gate.gif" alt="" width="1" height="1">
<?php endif; ?>
<?php
ActiveForm::end();
