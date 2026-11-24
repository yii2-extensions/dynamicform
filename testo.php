<?php

declare(strict_types=1);

use Testo\Application\Config\{ApplicationConfig, FinderConfig, SuiteConfig};

// Let Testo own the error handlers when a test creates a Yii application.
defined('YII_ENABLE_ERROR_HANDLER') || define('YII_ENABLE_ERROR_HANDLER', false);

// Testo has no bootstrap option: the Yii constants and the `Yii` class are loaded before discovery.
require_once __DIR__ . '/tests/bootstrap.php';

return new ApplicationConfig(
    src: ['src'],
    suites: [
        new SuiteConfig(
            name: 'DynamicForm',
            location: new FinderConfig(
                include: ['tests'],
                exclude: [
                    'tests/browser',
                    'tests/js',
                    'tests/Provider',
                    'tests/Support',
                ],
            ),
        ),
    ],
);
