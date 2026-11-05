<?php

declare(strict_types=1);

namespace Yii2\Extensions\DynamicForm\Tests;

use PHPUnit\Framework\Attributes\{DataProviderExternal, Group, RequiresPhpExtension};
use Yii;
use Yii2\Extensions\DynamicForm\DynamicFormAsset;
use Yii2\Extensions\DynamicForm\Tests\Provider\DynamicFormAssetProvider;
use Yii2\Extensions\DynamicForm\Tests\Support\{InspectableDynamicFormAsset, TestCase};

use function dirname;

use const DIRECTORY_SEPARATOR;

/**
 * Unit tests for {@see DynamicFormAsset} file selection per `YII_DEBUG` mode and application overrides.
 *
 * The test bootstrap defines `YII_DEBUG` as `true`; the production-mode cases redefine the constant through the
 * runkit7 extension and restore it afterwards, so they are skipped where the extension is not loaded.
 *
 * {@see DynamicFormAssetProvider} for test case data providers.
 */
#[Group('asset')]
final class DynamicFormAssetTest extends TestCase
{
    /**
     * @param array<string, mixed> $config
     * @param list<string> $expectedJs
     */
    #[DataProviderExternal(DynamicFormAssetProvider::class, 'debugOverrides')]
    public function testBundleStateInDebugMode(array $config, string $expectedSourcePath, array $expectedJs): void
    {
        self::assertTrue(
            YII_DEBUG,
            'The test bootstrap must run in debug mode.',
        );

        Yii::setAlias(
            '@dynamicform-assets',
            dirname(__DIR__) . DIRECTORY_SEPARATOR . 'src/assets',
        );

        $asset = new DynamicFormAsset($config);

        self::assertSame(
            [
                'sourcePath' => $expectedSourcePath,
                'js' => $expectedJs,
                'css' => [],
                'depends' => ['yii\web\JqueryAsset', 'yii\widgets\ActiveFormAsset'],
            ],
            [
                'sourcePath' => $asset->sourcePath,
                'js' => $asset->js,
                'css' => $asset->css,
                'depends' => $asset->depends,
            ],
            'Bundle must keep application overrides and resolve the source path.',
        );
    }

    /**
     * @param array<string, mixed> $config
     * @param list<string> $expectedJs
     */
    #[DataProviderExternal(DynamicFormAssetProvider::class, 'productionConfigurations')]
    #[RequiresPhpExtension('runkit7')]
    public function testBundleStateInProductionMode(array $config, array $expectedJs): void
    {
        @\runkit_constant_redefine('YII_DEBUG', false);

        try {
            $asset = new DynamicFormAsset($config);

            self::assertSame(
                ['sourcePath' => dirname(__DIR__) . DIRECTORY_SEPARATOR . 'src/assets', 'js' => $expectedJs],
                ['sourcePath' => $asset->sourcePath, 'js' => $asset->js],
                'Minified file must be the default unless the application configures the scripts.',
            );
        } finally {
            @\runkit_constant_redefine('YII_DEBUG', true);
        }
    }

    public function testProtectedHooksAreCallableFromSubclasses(): void
    {
        $asset = new InspectableDynamicFormAsset(['sourcePath' => '/custom']);

        $asset->callSetSourcePath('/other');
        $asset->callSetupAssets('css', ['theme', 'print']);
        $asset->callSetupAssets('js', ['ignored']);

        self::assertSame(
            ['sourcePath' => '/custom', 'css' => ['theme.css', 'print.css'], 'js' => ['yii2-dynamic-form.js']],
            ['sourcePath' => $asset->sourcePath, 'css' => $asset->css, 'js' => $asset->js],
            'Hooks must fill only empty settings, with the debug file names.',
        );
    }
}
