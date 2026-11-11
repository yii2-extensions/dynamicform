<?php

declare(strict_types=1);

use Testo\Application\Config\{ApplicationConfig, FinderConfig, SuiteConfig};

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
