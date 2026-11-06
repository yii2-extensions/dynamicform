<?php

declare(strict_types=1);

namespace Yii2\Extensions\DynamicForm\Tests\Support\Browser;

use yii\web\AssetBundle;

use function dirname;

/**
 * Publishes the TomSelect 2.4.3 distribution the `tom-select` npm development dependency installs, so the browser
 * fixture serves it locally: the complete build (core and bundled plugins), unminified with `YII_DEBUG` and minified
 * otherwise, as an application would choose it.
 */
final class TomSelectAsset extends AssetBundle
{
    public $css = ['css/tom-select.css'];

    public function init(): void
    {
        $this->sourcePath = dirname(__DIR__, 3) . '/node_modules/tom-select/dist';
        $this->js = [YII_DEBUG ? 'js/tom-select.complete.js' : 'js/tom-select.complete.min.js'];

        parent::init();
    }
}
