<?php

declare(strict_types=1);

namespace Yii2\Extensions\DynamicForm\Tests\Provider;

use function dirname;

use const DIRECTORY_SEPARATOR;

/**
 * Data provider for {@see \Yii2\Extensions\DynamicForm\Tests\DynamicFormAssetTest} test cases.
 */
final class DynamicFormAssetProvider
{
    /**
     * @return iterable<string, array{array<string, mixed>, string, list<string>}>
     */
    public static function debugOverrides(): iterable
    {
        // DynamicFormAsset uses `__DIR__ . '/assets'`, so the separator before `src` is the platform one.
        $assets = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'src/assets';

        yield 'defaults' => [
            [],
            $assets,
            ['yii2-dynamic-form.js'],
        ];
        yield 'configured source path and scripts' => [
            ['sourcePath' => '/custom', 'js' => ['custom.js']],
            '/custom',
            ['custom.js'],
        ];
        yield 'configured scripts only' => [
            ['js' => ['custom.js']],
            $assets,
            ['custom.js'],
        ];
        yield 'configured source path only' => [
            ['sourcePath' => '/custom'],
            '/custom',
            ['yii2-dynamic-form.js'],
        ];
        yield 'aliased source path with trailing slash' => [
            ['sourcePath' => '@dynamicform-assets/'],
            $assets,
            ['yii2-dynamic-form.js'],
        ];
    }

    /**
     * @return iterable<string, array{array<string, mixed>, list<string>}>
     */
    public static function productionConfigurations(): iterable
    {
        yield 'defaults' => [
            [],
            ['yii2-dynamic-form.min.js'],
        ];
        yield 'configured scripts win over the minified default' => [
            ['js' => ['yii2-dynamic-form.js']],
            ['yii2-dynamic-form.js'],
        ];
        yield 'configured source path keeps the minified default' => [
            ['sourcePath' => dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'src/assets'],
            ['yii2-dynamic-form.min.js'],
        ];
    }
}
