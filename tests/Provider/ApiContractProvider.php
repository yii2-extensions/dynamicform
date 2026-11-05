<?php

declare(strict_types=1);

namespace Yii2\Extensions\DynamicForm\Tests\Provider;

use Yii2\Extensions\DynamicForm\{DynamicFormAsset, DynamicFormWidget};
use Yii2\Extensions\DynamicForm\Models\Model;

/**
 * Data provider for {@see \Yii2\Extensions\DynamicForm\Tests\ApiContractTest} test cases.
 */
final class ApiContractProvider
{
    /**
     * @return iterable<string, array{class-string, array<string, string>}>
     */
    public static function releasedApi(): iterable
    {
        yield 'DynamicFormAsset' => [
            DynamicFormAsset::class,
            [
                '$depends' => "public \$depends = array (\n  0 => 'yii\\\\web\\\\JqueryAsset',\n"
                    . "  1 => 'yii\\\\widgets\\\\ActiveFormAsset',\n)",
                'init()' => 'public function init()',
                'setSourcePath()' => 'protected function setSourcePath($path)',
                'setupAssets()' => "protected function setupAssets(\$type, \$files = array (\n))",
            ],
        ];
        yield 'DynamicFormWidget' => [
            DynamicFormWidget::class,
            [
                '$deleteButton' => 'public $deleteButton = NULL',
                '$formFields' => 'public $formFields = NULL',
                '$formId' => 'public $formId = NULL',
                '$insertButton' => 'public $insertButton = NULL',
                '$insertPosition' => "public \$insertPosition = 'bottom'",
                '$limit' => 'public $limit = 999',
                '$min' => 'public $min = 1',
                '$model' => 'public $model = NULL',
                '$widgetBody' => 'public $widgetBody = NULL',
                '$widgetContainer' => 'public $widgetContainer = NULL',
                '$widgetItem' => 'public $widgetItem = NULL',
                'const WIDGET_NAME' => "public const WIDGET_NAME = 'dynamicform'",
                'getHashVarName()' => 'protected function getHashVarName()',
                'hashOptions()' => 'protected function hashOptions()',
                'init()' => 'public function init()',
                'initOptions()' => 'protected function initOptions()',
                'registerAssets()' => 'public function registerAssets($view)',
                'registerHashVarWidget()' => 'public function registerHashVarWidget()',
                'registerOptions()' => 'protected function registerOptions($view)',
                'run()' => 'public function run()',
            ],
        ];
        yield 'Model' => [
            Model::class,
            [
                'createMultiple()' => 'public static function createMultiple($modelClass, '
                    . "\$multipleModels = array (\n), \$pk = 'id')",
            ],
        ];
    }
}
