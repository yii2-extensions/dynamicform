<?php

declare(strict_types=1);

/**
 * Renders the real Kartik Select2 and DepDrop widgets inside DynamicFormWidget rows, in the shape of issue #6.
 *
 * Form `kartik-form` holds two widgets whose names carry the literal keys `[Production]` and `[Sales]` after the row
 * index (`Row[0][Production][branch]`): Production starts with a stored row, Sales with none (`min` 0, new model).
 * Form `numeric-form` holds one widget whose rows are posted under `Row[2024]`, a numeric literal key before the index.
 * DepDrop requests and Select2 AJAX searches go to the local endpoints of the fixture router.
 *
 * @var yii\web\View $this
 * @var array{name: string, submitUrl: string, endpointUrl: string} $scenario
 */

use kartik\depdrop\DepDrop;
use kartik\select2\Select2;
use yii\helpers\Html;
use yii\web\JsExpression;
use yii\widgets\ActiveForm;
use Yii2\Extensions\DynamicForm\DynamicFormWidget;
use Yii2\Extensions\DynamicForm\Tests\Support\Browser\KartikCatalog;
use Yii2\Extensions\DynamicForm\Tests\Support\KartikFormModel;

$this->title = 'DynamicForm ' . $scenario['name'];

$stored = static fn(string $formName): KartikFormModel => new KartikFormModel(
    [
        'formName' => $formName,
        'id' => 1,
        'branch' => 'b1',
        'tags' => ['t1', 't2'],
        'owner' => 'o2',
        'country' => 'es',
        'region' => 'es-north',
        'site' => 'es-main',
    ],
);

/**
 * Renders one row; `$key` is the literal key after the row index (`[Production]`), or `''`.
 */
$row = static function (ActiveForm $form, KartikFormModel $model, int $i, string $key) use ($scenario): string {
    $attribute = static fn(string $name): string => "[{$i}]{$key}{$name}";
    $country = Html::getInputId($model, $attribute('country'));
    $countryValue = is_string($model->country) ? $model->country : '';

    return '<div class="item">'
        . Html::activeHiddenInput($model, $attribute('id'))
        . $form->field($model, $attribute('branch'))->widget(
            Select2::class,
            [
                'data' => KartikCatalog::BRANCHES,
                'options' => ['placeholder' => 'Select branch'],
                'pluginOptions' => ['allowClear' => true],
            ],
        )
        . $form->field($model, $attribute('tags'))->widget(
            Select2::class,
            ['data' => KartikCatalog::TAGS, 'options' => ['multiple' => true]],
        )
        . $form->field($model, $attribute('owner'))->widget(
            Select2::class,
            [
                'initValueText' => is_string($model->owner) ? KartikCatalog::OWNERS[$model->owner] ?? '' : '',
                'options' => ['placeholder' => 'Find owner'],
                'pluginOptions' => [
                    'minimumInputLength' => 0,
                    'ajax' => [
                        'url' => "{$scenario['endpointUrl']}/lookup/owners",
                        'dataType' => 'json',
                        'delay' => 0,
                        'data' => new JsExpression('function (params) { return { q: params.term || "" }; }'),
                    ],
                ],
            ],
        )
        . $form->field($model, $attribute('country'))->dropDownList(
            KartikCatalog::COUNTRIES,
            ['prompt' => 'Select country'],
        )
        . $form->field($model, $attribute('region'))->widget(
            DepDrop::class,
            [
                'data' => KartikCatalog::dependentOptions('regions', $countryValue),
                'options' => ['placeholder' => 'Select region'],
                'pluginOptions' => [
                    'depends' => [$country],
                    'params' => [Html::getInputId($model, $attribute('branch'))],
                    'placeholder' => 'Select region',
                    'url' => "{$scenario['endpointUrl']}/depdrop/regions",
                ],
            ],
        )
        . $form->field($model, $attribute('site'))->widget(
            DepDrop::class,
            [
                'type' => DepDrop::TYPE_SELECT2,
                'data' => KartikCatalog::dependentOptions('sites', $countryValue),
                'options' => ['placeholder' => 'Select site'],
                'select2Options' => ['pluginOptions' => ['allowClear' => true]],
                'pluginOptions' => [
                    'depends' => [$country],
                    'placeholder' => 'Select site',
                    'url' => "{$scenario['endpointUrl']}/depdrop/sites",
                ],
            ],
        )
        . '<button type="button" class="add-item">Add</button>'
        . '<button type="button" class="remove-item">Remove</button>'
        . '</div>';
};

$fields = static fn(string $key): array => array_map(
    static fn(string $name): string => "{$key}{$name}",
    ['branch', 'tags', 'owner', 'country', 'region', 'site'],
);

$form = ActiveForm::begin(['id' => 'kartik-form', 'action' => $scenario['submitUrl']]);

foreach (['Production' => [$stored('Row')], 'Sales' => [new KartikFormModel(['formName' => 'Row', 'isNewRecord' => true])]] as $segment => $models) {
    DynamicFormWidget::begin(
        [
            'widgetContainer' => 'dynamicform_' . strtolower($segment),
            'widgetBody' => '.container-items',
            'widgetItem' => '.item',
            'limit' => 4,
            'min' => 0,
            'insertButton' => '.add-item',
            'deleteButton' => '.remove-item',
            'model' => $models[0],
            'formId' => 'kartik-form',
            'formFields' => $fields("[{$segment}]"),
        ],
    );

    echo '<div class="container-items">';

    foreach ($models as $i => $model) {
        echo $row($form, $model, $i, "[{$segment}]");
    }

    echo '</div><button type="button" class="add-item add-first">Add</button>';

    DynamicFormWidget::end();
}

echo '<button type="submit" class="submit">Save</button>';

ActiveForm::end();

$form = ActiveForm::begin(['id' => 'numeric-form', 'action' => $scenario['submitUrl']]);

DynamicFormWidget::begin(
    [
        'widgetContainer' => 'dynamicform_numeric',
        'widgetBody' => '.container-items',
        'widgetItem' => '.item',
        'limit' => 3,
        'min' => 1,
        'insertButton' => '.add-item',
        'deleteButton' => '.remove-item',
        'model' => $stored('Row[2024]'),
        'formId' => 'numeric-form',
        'formFields' => $fields(''),
    ],
);

echo '<div class="container-items">', $row($form, $stored('Row[2024]'), 0, ''), '</div>';

DynamicFormWidget::end();

echo '<button type="submit" class="submit">Save</button>';

ActiveForm::end();
