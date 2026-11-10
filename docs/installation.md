# Installation guide

This guide describes the upcoming 2.0 line. Match the documentation to the revision installed in your application.

## System requirements

- [`PHP`](https://www.php.net/downloads) 8.1 or higher with the `dom` extension.
- [`Composer`](https://getcomposer.org/download/) for dependency management.
- [`Yii2`](https://github.com/yiisoft/yii2) 2.0.55 or higher, or the `22.0.x` development line, which needs PHP 8.3 or
  higher; the application opts into it by requiring `yiisoft/yii2:22.0.x-dev`. Earlier 2.0 releases are affected by
  security advisories, the most recent being CVE-2026-39850.
- [`symfony/css-selector`](https://github.com/symfony/css-selector) and
  [`symfony/dom-crawler`](https://github.com/symfony/dom-crawler) 6.4 or 7.x; Composer selects 6.4 on PHP 8.1.

## Installation

Install the stable 1.x line with [Composer](https://getcomposer.org/download/). Its requirements and behavior differ
from the development version described here; use the documentation at the installed release tag.

```bash
composer require --prefer-dist yii2-extensions/dynamicform:^1.0
```

### Development version

Until 2.0 is released, explicitly opt into the development branch if you need its changes:

```bash
composer require --prefer-dist yii2-extensions/dynamicform:dev-master
```

Development installations track a moving branch; verify the installed revision. The 1.x releases do not include the
`yii2-dynamicform` agent skill. A stable `^2.0` requirement is usable only after a 2.0 release is published.

## Assets

The widget registers `Yii2\Extensions\DynamicForm\DynamicFormAsset`, which depends on `yii\web\JqueryAsset` and
`yii\widgets\ActiveFormAsset`. Yii's asset manager publishes the plugin shipped with the package; no Node.js build is
needed for the widget. The application must provide jQuery at the path used by its installed `JqueryAsset`:
`@bower/jquery/dist` for Yii 2.0.55, or `@npm/jquery/dist` for Yii 22. Keep any deliberate asset-bundle overrides.

### Yii 22 client validation

Yii 22 needs the 2.0 development installation above; the stable 1.x extension does not accept Yii 22. The framework only
suggests the jQuery client-script implementation. Install it explicitly alongside the development Yii version (PHP 8.3
or higher):

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
