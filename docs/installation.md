# Installation guide

## System requirements

- [`PHP`](https://www.php.net/downloads) 8.3 or higher with the `dom` extension.
- [`Composer`](https://getcomposer.org/download/) for dependency management.
- [`Yii2`](https://github.com/yiisoft/yii2) 2.0.55 or higher, or the `22.0.x` development line; the application opts
  into it by requiring `yiisoft/yii2:22.0.x-dev`. Earlier 2.0 releases are affected by security advisories, the most
  recent being CVE-2026-39850.
- [`symfony/css-selector`](https://github.com/symfony/css-selector) and
  [`symfony/dom-crawler`](https://github.com/symfony/dom-crawler) 6.4 or 7.x.

## Installation

```bash
composer require --prefer-dist yii2-extensions/dynamicform:^2.0
```

## Assets

The widget registers `Yii2\Extensions\DynamicForm\DynamicFormAsset`, which depends on `yii\web\JqueryAsset` and
`yii\widgets\ActiveFormAsset`. Yii's asset manager publishes the plugin shipped with the package; no Node.js build is
needed for the widget. The application must provide jQuery at the path used by its installed `JqueryAsset`:
`@bower/jquery/dist` for Yii 2.0.55, or `@npm/jquery/dist` for Yii 22. Keep any deliberate asset-bundle overrides.

### Yii 22 client validation

Yii 22 only suggests the jQuery client-script implementation. Install it explicitly alongside the development Yii
version:

```bash
composer require --prefer-dist yiisoft/yii2:22.0.x-dev yiisoft/yii2-jquery:dev-master
```

Register its bootstrap before creating forms and validators, merging this entry into the application's existing
bootstrap list:

```php
return [
    'bootstrap' => [
        \yii\jquery\Bootstrap::class,
    ],
];
```

Provide the jQuery distribution at `@npm/jquery/dist`, for example through the application's npm assets and `@npm`
alias, or configure `yii\web\JqueryAsset` to use an existing jQuery distribution. Registering the assets alone does not
configure Yii 22's `ActiveForm` client validation. Verify `yii.activeForm` is initialized and newly inserted rows
validate in a real browser; the package's browser suite currently exercises Yii 2.0.55, not Yii 22.

### Debug and production assets

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
