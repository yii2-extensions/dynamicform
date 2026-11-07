<?php

declare(strict_types=1);

/**
 * Renders Yii `MaskedInput` controls (Inputmask from `bower-asset/inputmask`) inside DynamicFormWidget rows.
 *
 * `MaskedInput` stores its client options in a page variable named by `data-plugin-inputmask` and masks each rendered
 * input on DOM ready; DynamicForm masks the inputs of inserted rows from that variable. Three forms:
 *
 * - `inputmask-form`: two stored rows (`Contact[<i>][...]`) with `phone` (`999-9999`) and `code` (`AA-999`,
 *   `clearIncomplete`), `min` 1, `limit` 4, plus a masked input outside the rows.
 * - `zero-form`: a new model with `min` 0, so the server renders no row (`Line[<i>][phone]`).
 * - `nested-form`: houses (`.house`) holding rooms (`.item`) with a masked `phone`.
 *
 * @var yii\web\View $this
 * @var array{name: string, submitUrl: string} $scenario
 */

use yii\helpers\Html;
use yii\widgets\{ActiveForm, MaskedInput};
use Yii2\Extensions\DynamicForm\DynamicFormWidget;
use Yii2\Extensions\DynamicForm\Tests\Support\{FormModel, InputmaskFormModel};

$this->title = 'DynamicForm ' . $scenario['name'];

$phone = ['class' => MaskedInput::class, 'mask' => '999-9999'];
$code = ['class' => MaskedInput::class, 'mask' => 'AA-999', 'clientOptions' => ['clearIncomplete' => true]];

$stored = static fn(string $formName, array $values): InputmaskFormModel => new InputmaskFormModel(
    ['formName' => $formName] + $values,
);

$buttons = '<button type="button" class="add-item">Add</button>'
    . '<button type="button" class="remove-item">Remove</button>';

$form = ActiveForm::begin(['id' => 'inputmask-form', 'action' => $scenario['submitUrl']]);

$contacts = [
    $stored('Contact', ['id' => 1, 'name' => 'n0', 'phone' => '555-0100', 'code' => 'AB-123']),
    $stored('Contact', ['id' => 2, 'name' => 'n1', 'phone' => '555-0111', 'code' => 'CD-456']),
];

DynamicFormWidget::begin(
    [
        'widgetContainer' => 'dynamicform_contacts',
        'widgetBody' => '.container-items',
        'widgetItem' => '.item',
        'limit' => 4,
        'min' => 1,
        'insertButton' => '.add-item',
        'deleteButton' => '.remove-item',
        'model' => $contacts[0],
        'formId' => 'inputmask-form',
        'formFields' => ['name', 'phone', 'code'],
    ],
);

echo '<div class="container-items">';

foreach ($contacts as $i => $contact) {
    echo '<div class="item">'
        . Html::activeHiddenInput($contact, "[{$i}]id")
        . $form->field($contact, "[{$i}]name")->textInput()
        . $form->field($contact, "[{$i}]phone")->widget(MaskedInput::class, $phone)
        . $form->field($contact, "[{$i}]code")->widget(MaskedInput::class, $code)
        . $buttons
        . '</div>';
}

echo '</div><button type="button" class="add-item add-first">Add</button>';

DynamicFormWidget::end();

echo MaskedInput::widget(['name' => 'outside', 'id' => 'outside-phone', 'value' => '555-0199'] + $phone);
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
        'formFields' => ['phone'],
    ],
);

echo '<div class="container-lines"><div class="item">'
    . $form->field($line, '[0]phone')->widget(MaskedInput::class, $phone)
    . $buttons
    . '</div></div><button type="button" class="add-item add-first">Add</button>';

DynamicFormWidget::end();

echo '<button type="submit" class="submit">Save</button>';

ActiveForm::end();

$form = ActiveForm::begin(['id' => 'nested-form', 'action' => $scenario['submitUrl']]);

$house = new FormModel(['formName' => 'House', 'name' => 'h0']);
$room = $stored('Room', ['name' => 'r00', 'phone' => '555-0123']);

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
        'formFields' => ['name', 'phone'],
    ],
);

echo '<div class="rooms"><div class="item">'
    . $form->field($room, '[0][0]name')->textInput()
    . $form->field($room, '[0][0]phone')->widget(MaskedInput::class, $phone)
    . '<button type="button" class="remove-room">Remove room</button>'
    . '</div></div><button type="button" class="add-room">Add room</button>';

DynamicFormWidget::end();

echo '<button type="button" class="remove-house">Remove house</button></div></div>'
    . '<button type="button" class="add-house">Add house</button>';

DynamicFormWidget::end();

echo '<button type="submit" class="submit">Save</button>';

ActiveForm::end();
