<?php

declare(strict_types=1);

/**
 * Renders two forms with reset buttons: stored rows holding every kind of control a form reset restores, and a sibling
 * form with its own widget and stored row.
 *
 * @var yii\web\View $this
 * @var array{name: string, submitUrl: string} $scenario
 */

use yii\helpers\Html;
use yii\widgets\ActiveForm;
use Yii2\Extensions\DynamicForm\DynamicFormWidget;
use Yii2\Extensions\DynamicForm\Tests\Support\{ControlsFormModel, PersistedFormModel};

$this->title = 'DynamicForm ' . $scenario['name'];

$kinds = ['a' => 'A', 'b' => 'B', 'c' => 'C'];
$models = [
    new ControlsFormModel(
        [
            'formName' => 'Controls',
            'id' => 1,
            'name' => 'Saved',
            'notes' => 'Long text',
            'kind' => 'b',
            'size' => 'm',
            'tags' => ['a', 'c'],
            'flag' => 'yes',
            'level' => 'high',
            'locked' => 'L',
        ],
    ),
    new ControlsFormModel(
        [
            'formName' => 'Controls',
            'id' => 2,
            'name' => 'Second',
            'notes' => 'Other text',
            'kind' => 'c',
            'size' => 's',
            'tags' => ['b'],
            'flag' => 'no',
            'level' => 'low',
            'locked' => 'M',
        ],
    ),
];

$form = ActiveForm::begin(['id' => 'dynamic-form', 'action' => $scenario['submitUrl']]);

DynamicFormWidget::begin([
    'widgetContainer' => 'dynamicform_wrapper',
    'widgetBody' => '.container-items',
    'widgetItem' => '.item',
    'limit' => 6,
    'min' => 1,
    'insertButton' => '.add-item',
    'deleteButton' => '.remove-item',
    'model' => $models[0],
    'formId' => 'dynamic-form',
    'formFields' => ['name', 'notes', 'kind', 'size', 'tags', 'flag', 'level', 'locked'],
]);
?>
<div class="container-items">
<?php foreach ($models as $i => $model): ?>
    <div class="item">
        <?= Html::activeHiddenInput($model, "[{$i}]id") ?>
        <?= $form->field($model, "[{$i}]name")->textInput() ?>
        <?= $form->field($model, "[{$i}]notes")->textarea() ?>
        <?= $form->field($model, "[{$i}]kind")->dropDownList($kinds, ['prompt' => 'Choose']) ?>
        <?= $form->field($model, "[{$i}]size")->dropDownList(['s' => 'S', 'm' => 'M']) ?>
        <?= $form->field($model, "[{$i}]tags")->listBox($kinds, ['multiple' => true]) ?>
        <?= $form->field($model, "[{$i}]flag")->checkbox(['value' => 'yes', 'uncheck' => 'no']) ?>
        <?= $form->field($model, "[{$i}]level")->radioList(['low' => 'Low', 'high' => 'High']) ?>
        <?= $form->field($model, "[{$i}]locked")->textInput(['disabled' => true]) ?>
        <button type="button" class="add-item">Add row</button>
        <button type="button" class="remove-item">Remove row</button>
    </div>
<?php endforeach; ?>
</div>
<?php
DynamicFormWidget::end();
?>
<button type="submit" class="submit">Save</button>
<button type="reset" class="reset">Reset</button>
<?php
ActiveForm::end();

$other = new PersistedFormModel(['formName' => 'Other', 'id' => 9, 'name' => 'Kept']);
$otherForm = ActiveForm::begin(['id' => 'other-form', 'action' => $scenario['submitUrl']]);

DynamicFormWidget::begin([
    'widgetContainer' => 'dynamicform_other',
    'widgetBody' => '.items',
    'widgetItem' => '.item',
    'limit' => 4,
    'min' => 1,
    'insertButton' => '.add-other',
    'deleteButton' => '.remove-other',
    'model' => $other,
    'formId' => 'other-form',
    'formFields' => ['name'],
]);
?>
<div class="items">
    <div class="item">
        <?= Html::activeHiddenInput($other, '[0]id') ?>
        <?= $otherForm->field($other, '[0]name')->textInput() ?>
        <button type="button" class="add-other">Add row</button>
        <button type="button" class="remove-other">Remove row</button>
    </div>
</div>
<?php
DynamicFormWidget::end();
?>
<button type="submit" class="submit">Save</button>
<button type="reset" class="reset">Reset</button>
<?php
ActiveForm::end();
