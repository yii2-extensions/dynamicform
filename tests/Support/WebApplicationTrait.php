<?php

declare(strict_types=1);

namespace Yii2\Extensions\DynamicForm\Tests\Support;

use ReflectionClass;
use ReflectionMethod;
use Testo\Assert;
use Testo\Lifecycle\BeforeTest;
use Yii;
use yii\di\Container;
use yii\web\{Application, AssetManager, View};

use function array_keys;
use function array_values;
use function dirname;
use function ob_get_clean;
use function ob_start;
use function strstr;

/**
 * Creates an isolated Yii web application before each test and reads the scripts registered in its view.
 *
 * Testo restores no global state between tests, so {@see self::createWebApplication()} also replaces the DI container.
 */
trait WebApplicationTrait
{
    /**
     * Replaces the DI container and creates a web application whose asset bundles resolve to dummies without files, so
     * rendered pages contain only the inline scripts.
     */
    #[BeforeTest]
    protected function createWebApplication(): void
    {
        Yii::$container = new Container();

        new Application(
            [
                'id' => 'dynamicform-tests',
                'basePath' => __DIR__,
                'vendorPath' => dirname(__DIR__, 2) . '/vendor',
                'runtimePath' => dirname(__DIR__, 2) . '/runtime',
                'aliases' => ['@bower' => '@vendor/bower-asset', '@npm' => '@vendor/npm-asset'],
                'components' => [
                    'request' => [
                        'cookieValidationKey' => 'test-only',
                        'scriptFile' => __FILE__,
                        'scriptUrl' => '/index.php',
                    ],
                    'assetManager' => ['class' => AssetManager::class, 'bundles' => false],
                ],
            ],
        );
    }

    /**
     * Returns the inline scripts registered at a position, in registration order.
     *
     * @return list<string>
     */
    protected static function registeredJs(int $position): array
    {
        $scripts = self::webView()->js[$position] ?? [];

        Assert::iterable($scripts)->allOf('string');

        /** @var array<string> $scripts */
        return array_values($scripts);
    }

    /**
     * Returns the positions that hold inline scripts, in the order they were first used.
     *
     * @return list<int>
     */
    protected static function registeredJsPositions(): array
    {
        return array_keys(self::webView()->js);
    }

    /**
     * Renders a complete page around the callback output through the application view.
     *
     * @param callable(): void $body Echoes the page body.
     */
    protected static function renderPage(callable $body): string
    {
        $view = self::webView();

        ob_start();

        $view->beginPage();
        $view->head();
        $view->beginBody();

        $body();

        $view->endBody();
        $view->endPage();

        return (string) ob_get_clean();
    }

    /**
     * Returns the first line of the `POS_READY` and `POS_LOAD` script wrappers of the installed Yii.
     *
     * Yii 2.0 opens them with jQuery callbacks; Yii 22.0 builds DOM event listeners through `View::wrapReadyScript()`
     * and `View::wrapLoadScript()`. Both close the wrapper with `});` on its own line.
     *
     * @return array{string, string} Opening line of the ready wrapper and of the load wrapper.
     */
    protected static function scriptWrapperOpenings(): array
    {
        if (!(new ReflectionClass(View::class))->hasMethod('wrapReadyScript')) {
            return ['jQuery(function ($) {', "jQuery(window).on('load', function () {"];
        }

        $openings = [];

        foreach (['wrapReadyScript', 'wrapLoadScript'] as $method) {
            $wrapped = (new ReflectionMethod(View::class, $method))->invoke(self::webView(), '');

            Assert::string($wrapped);

            $openings[] = (string) strstr($wrapped, "\n", true);
        }

        return [
            $openings[0],
            $openings[1],
        ];
    }

    protected static function webView(): View
    {
        $view = Yii::$app->getView();

        Assert::instanceOf($view, View::class, 'The test application must use a web view.');

        return $view;
    }
}
