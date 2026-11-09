<?php

declare(strict_types=1);

/**
 * Renders a tabular form through ActiveForm and DynamicFormWidget::begin()/end().
 *
 * @var yii\web\View $this
 * @var array{
 *   name: string,
 *   clientValidation: bool,
 *   clientScript: bool,
 *   formId: string,
 *   min: int,
 *   persisted: bool,
 *   loadGate: bool,
 *   insertButton: string,
 *   deleteButton: string,
 *   rowFormName: string,
 *   codeKey: string,
 *   codeId: string,
 *   foreignContainer: bool,
 *   submitUrl: string
 * } $scenario
 */

use yii\helpers\Html;
use yii\web\View;
use yii\widgets\ActiveForm;
use Yii2\Extensions\DynamicForm\DynamicFormWidget;
use Yii2\Extensions\DynamicForm\Tests\Support\{FormModel, PersistedFormModel};

$this->title = 'DynamicForm ' . $scenario['name'];
// A stored row, or a new model whose empty row the server removes when min is 0. `rowFormName` may hold literal keys
// before the row index and `codeKey` literal keys between the row index and the `code` attribute; a non-empty
// `codeId` replaces the generated id of the `code` input.
$models = [
    $scenario['persisted']
        ? new PersistedFormModel(['formName' => $scenario['rowFormName'], 'id' => 1, 'name' => 'Saved', 'code' => 'A1'])
        : new FormModel(['formName' => $scenario['rowFormName']]),
];
$code = "{$scenario['codeKey']}code";

$form = ActiveForm::begin([
    'id' => $scenario['formId'],
    'action' => $scenario['submitUrl'],
    'enableClientValidation' => $scenario['clientValidation'],
    'enableClientScript' => $scenario['clientScript'],
]);

if ($scenario['foreignContainer']) {
    // A non-widget element sharing the container class sits before the widget to verify that init skips it.
    echo '<p class="dynamicform_wrapper" id="foreign-container"></p>';
    // A flag set at POS_LOAD after the widget initialization confirms that the foreign element does not block it.
    $this->registerJs('window.__posLoadRan = true;', View::POS_LOAD);
}

DynamicFormWidget::begin([
    'widgetContainer' => 'dynamicform_wrapper',
    'widgetBody' => '.container-items',
    'widgetItem' => '.item',
    'limit' => 4,
    'min' => $scenario['min'],
    'insertButton' => $scenario['insertButton'],
    'deleteButton' => $scenario['deleteButton'],
    'model' => $models[0],
    'formId' => $scenario['formId'],
    'formFields' => ['name', $code],
]);
?>
<div class="container-items">
<?php foreach ($models as $i => $model): ?>
    <div class="item">
        <?php if ($scenario['persisted']): ?>
            <?= Html::activeHiddenInput($model, "[{$i}]id") ?>
        <?php endif; ?>
        <?= $form->field($model, "[{$i}]name")->textInput() ?>
        <?= $form->field($model, "[{$i}]{$code}")->textInput(
            $scenario['codeId'] === '' ? [] : ['id' => str_replace('{i}', (string) $i, $scenario['codeId'])],
        ) ?>
        <button type="button" class="add-item" data-role="add">Add row</button>
        <button type="button" class="remove-item" data-role="remove">Remove row</button>
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
