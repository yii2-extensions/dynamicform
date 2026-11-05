# Installation guide

## System requirements

- [`PHP`](https://www.php.net/downloads) 8.1 or higher with the `dom` extension.
- [`Composer`](https://getcomposer.org/download/) for dependency management.
- [`Yii2`](https://github.com/yiisoft/yii2) 2.0.49 or higher.

## Installation

Install the extension with [Composer](https://getcomposer.org/download/).

```bash
composer require --prefer-dist yii2-extensions/dynamicform:^1.0
```

## Assets

The widget registers `Yii2\Extensions\DynamicForm\DynamicFormAsset`, which depends on `yii\web\JqueryAsset` and
`yii\widgets\ActiveFormAsset`. Yii's asset manager publishes the jQuery plugin from the package, so the application
needs jQuery through its `@bower` alias, as in the Yii application templates, and no Node.js toolchain.

The bundle loads `yii2-dynamic-form.js` when `YII_DEBUG` is `true` and `yii2-dynamic-form.min.js` otherwise. Configure
the bundle through the asset manager to select the files yourself:

```php
return [
    'components' => [
        'assetManager' => [
            'bundles' => [
                Yii2\Extensions\DynamicForm\DynamicFormAsset::class => [
                    'js' => ['yii2-dynamic-form.js'],
                ],
            ],
        ],
    ],
];
```

[Back to documentation](../README.md#documentation)
