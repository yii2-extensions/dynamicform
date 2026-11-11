<?php

declare(strict_types=1);

namespace Yii2\Extensions\DynamicForm\Tests;

use Testo\Assert;
use Testo\Core\Exception\SkipTest;
use Testo\Data\DataProvider;
use Testo\Filter\Group;
use Testo\Test;
use Yii;
use Yii2\Extensions\DynamicForm\DynamicFormAsset;
use Yii2\Extensions\DynamicForm\Tests\Provider\DynamicFormAssetProvider;
use Yii2\Extensions\DynamicForm\Tests\Support\InspectableDynamicFormAsset;

use function dirname;
use function extension_loaded;

use const DIRECTORY_SEPARATOR;

/**
 * Unit tests for {@see DynamicFormAsset} file selection per `YII_DEBUG` mode and application overrides.
 *
 * The test bootstrap defines `YII_DEBUG` as `true`; the production-mode cases redefine the constant through the
 * runkit7 extension and restore it afterwards, so they are skipped where the extension is not loaded.
 *
 * {@see DynamicFormAssetProvider} for test case data providers.
 */
#[Test]
#[Group('asset')]
final class DynamicFormAssetTest
{
    /**
     * @param array<string, mixed> $config
     * @param list<string> $expectedJs
     */
    #[DataProvider(DynamicFormAssetProvider::class . '::debugOverrides')]
    public function bundleStateInDebugMode(array $config, string $expectedSourcePath, array $expectedJs): void
    {
        Assert::true(
            YII_DEBUG,
            'The test bootstrap must run in debug mode.',
        );

        Yii::setAlias(
            '@dynamicform-assets',
            dirname(__DIR__) . DIRECTORY_SEPARATOR . 'src/assets',
        );

        $asset = new DynamicFormAsset($config);

        Assert::same(
            [
                'sourcePath' => $asset->sourcePath,
                'js' => $asset->js,
                'css' => $asset->css,
                'depends' => $asset->depends,
            ],
            [
                'sourcePath' => $expectedSourcePath,
                'js' => $expectedJs,
                'css' => [],
                'depends' => ['yii\web\JqueryAsset', 'yii\widgets\ActiveFormAsset'],
            ],
            'Bundle must keep application overrides and resolve the source path.',
        );
    }

    /**
     * @param array<string, mixed> $config
     * @param list<string> $expectedJs
     */
    #[DataProvider(DynamicFormAssetProvider::class . '::productionConfigurations')]
    public function bundleStateInProductionMode(array $config, array $expectedJs): void
    {
        if (!extension_loaded('runkit7')) {
            throw new SkipTest('Redefining `YII_DEBUG` needs the runkit7 extension.');
        }

        @\runkit_constant_redefine('YII_DEBUG', false);

        try {
            $asset = new DynamicFormAsset($config);

            Assert::same(
                ['sourcePath' => $asset->sourcePath, 'js' => $asset->js],
                ['sourcePath' => dirname(__DIR__) . DIRECTORY_SEPARATOR . 'src/assets', 'js' => $expectedJs],
                'Minified file must be the default unless the application configures the scripts.',
            );
        } finally {
            @\runkit_constant_redefine('YII_DEBUG', true);
        }
    }

    public function protectedHooksAreCallableFromSubclasses(): void
    {
        $asset = new InspectableDynamicFormAsset(['sourcePath' => '/custom']);

        $asset->callSetSourcePath('/other');
        $asset->callSetupAssets('css', ['theme', 'print']);
        $asset->callSetupAssets('js', ['ignored']);

        Assert::same(
            ['sourcePath' => $asset->sourcePath, 'css' => $asset->css, 'js' => $asset->js],
            ['sourcePath' => '/custom', 'css' => ['theme.css', 'print.css'], 'js' => ['yii2-dynamic-form.js']],
            'Hooks must fill only empty settings, with the debug file names.',
        );
    }
}
