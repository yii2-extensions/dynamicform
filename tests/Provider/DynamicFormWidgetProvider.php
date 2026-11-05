<?php

declare(strict_types=1);

namespace Yii2\Extensions\DynamicForm\Tests\Provider;

use stdClass;
use Yii2\Extensions\DynamicForm\Tests\Support\{PersistedFormModel, RecordStateFormModel};

/**
 * Data provider for {@see \Yii2\Extensions\DynamicForm\Tests\DynamicFormWidgetTest} test cases.
 *
 * Provides invalid configurations with their complete exception messages, rendered fragments with the expected
 * container content and template, and configurations that rely on weak scalar comparisons.
 */
final class DynamicFormWidgetProvider
{
    /**
     * @return iterable<string, array{array<string, mixed>, string, 2?: string}>
     */
    public static function invalidConfigurations(): iterable
    {
        $container = 'Invalid configuration to property "widgetContainer". '
            . 'Allowed only alphanumeric characters plus underline: [A-Za-z0-9_]';
        $model = "The 'model' property must be set and must extend from '\\yii\\base\\Model'.";
        $position = "Invalid configuration to property 'insertPosition' (allowed values: 'bottom' or 'top')";

        yield 'widgetContainer missing' => [
            ['widgetContainer' => null],
            $container,
        ];
        yield 'widgetContainer empty' => [
            ['widgetContainer' => ''],
            $container,
        ];
        yield 'widgetContainer with hyphen' => [
            ['widgetContainer' => 'invalid-container'],
            $container,
        ];
        yield 'widgetContainer with space' => [
            ['widgetContainer' => 'dynamic form'],
            $container,
        ];
        yield 'widgetContainer with non-ASCII letter' => [
            ['widgetContainer' => 'formulario_ñ'],
            $container,
        ];
        yield 'widgetBody empty' => [
            ['widgetBody' => ''],
            "The 'widgetBody' property must be set.",
        ];
        yield 'widgetItem empty' => [
            ['widgetItem' => ''],
            "The 'widgetItem' property must be set.",
        ];
        yield 'model missing' => [
            ['model' => null],
            $model,
        ];
        yield 'model is not a Model' => [
            ['model' => new stdClass()],
            $model,
        ];
        yield 'formId empty' => [
            ['formId' => ''],
            "The 'formId' property must be set.",
        ];
        yield 'insertPosition empty' => [
            ['insertPosition' => ''],
            $position,
        ];
        yield 'insertPosition unknown' => [
            ['insertPosition' => 'middle'],
            $position,
        ];
        yield 'insertPosition is case sensitive' => [
            ['insertPosition' => 'Top'],
            $position,
        ];
        yield 'insertPosition is a boolean' => [
            ['insertPosition' => true],
            $position,
        ];
        yield 'formFields empty' => [
            ['formFields' => []],
            "The 'formFields' property must be set.",
        ];
        yield 'formFields is a string' => [
            ['formFields' => 'name'],
            "The 'formFields' property must be set.",
        ];
        yield 'widgetItem without a matching template item' => [
            [],
            'The "widgetItem" selector must match at least one template item.',
            '<div class="items"></div>',
        ];
    }

    /**
     * Fragments rendered between `begin()` and `end()`, with the expected container content and the first item that
     * becomes the client template.
     *
     * @return iterable<string, array{array<string, mixed>, string, string, string}>
     */
    public static function renderedFragments(): iterable
    {
        yield 'single row' => [
            [],
            '<div class="items"><div class="item">Row</div></div>',
            '<div class="items"><div class="item">Row</div></div>',
            '<div class="item">Row</div>',
        ];
        yield 'first of several rows becomes the template' => [
            [],
            '<div class="items"><div class="item" data-x="1">A <b>b</b></div><div class="item">B</div></div>',
            '<div class="items"><div class="item" data-x="1">A <b>b</b></div><div class="item">B</div></div>',
            '<div class="item" data-x="1">A <b>b</b></div>',
        ];
        yield 'table body rows' => [
            [],
            '<table class="items"><tbody><tr class="item"><td>Row</td></tr></tbody></table>',
            '<table class="items"><tbody><tr class="item"><td>Row</td></tr></tbody></table>',
            '<tr class="item"><td>Row</td></tr>',
        ];
        yield 'unicode text' => [
            [],
            '<div class="items"><div class="item">Ñandú € 日本</div></div>',
            '<div class="items"><div class="item">Ñandú € 日本</div></div>',
            '<div class="item">Ñandú € 日本</div>',
        ];
        yield 'zero minimum removes rows of a plain model' => [
            ['min' => 0],
            '<div class="items"><div class="item">Row</div></div>',
            '<div class="items"></div>',
            '<div class="item">Row</div>',
        ];
        yield 'zero minimum removes every row and keeps siblings' => [
            ['min' => 0],
            "<h2>Title</h2>\n<div class=\"items\"><div class=\"item\">A</div><div class=\"item\">B</div></div>\n"
            . '<button class="add">+</button>',
            "<h2>Title</h2>\n<div class=\"items\"></div>\n<button class=\"add\">+</button>",
            '<div class="item">A</div>',
        ];
        yield 'zero minimum keeps unicode siblings' => [
            ['min' => 0],
            '<p>Ñandú</p><div class="items"><div class="item">Ñandú €</div></div><span>tail</span>',
            '<p>Ñandú</p><div class="items"></div><span>tail</span>',
            '<div class="item">Ñandú €</div>',
        ];
        yield 'zero minimum keeps the table body' => [
            ['min' => 0],
            '<table class="items"><tbody><tr class="item"><td>Row</td></tr></tbody></table>',
            '<table class="items"><tbody></tbody></table>',
            '<tr class="item"><td>Row</td></tr>',
        ];
        yield 'zero minimum keeps rows of a persisted model' => [
            ['min' => 0, 'model' => new PersistedFormModel()],
            '<div class="items"><div class="item">Row</div></div>',
            '<div class="items"><div class="item">Row</div></div>',
            '<div class="item">Row</div>',
        ];
        yield 'zero minimum removes rows of a new record getter' => [
            ['min' => 0, 'model' => new RecordStateFormModel(true)],
            '<div class="items"><div class="item">Row</div></div>',
            '<div class="items"></div>',
            '<div class="item">Row</div>',
        ];
        yield 'zero minimum keeps rows of a persisted record getter' => [
            ['min' => 0, 'model' => new RecordStateFormModel(false)],
            '<div class="items"><div class="item">Row</div></div>',
            '<div class="items"><div class="item">Row</div></div>',
            '<div class="item">Row</div>',
        ];
    }

    /**
     * Configurations accepted through weak scalar comparisons; they characterize the current coercion contract.
     *
     * @return iterable<string, array{array<string, mixed>, string, string, mixed}>
     */
    public static function weakScalarConfigurations(): iterable
    {
        yield 'string zero minimum is not the zero minimum' => [
            ['min' => '0'],
            '<div class="items"><div class="item">Row</div></div>',
            'min',
            '0',
        ];
        yield 'numeric string limit is emitted unchanged' => [
            ['limit' => '5'],
            '<div class="items"><div class="item">Row</div></div>',
            'limit',
            '5',
        ];
    }
}
