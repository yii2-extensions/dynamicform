<?php

declare(strict_types=1);

use PhpCsFixer\Fixer\Strict\{DeclareStrictTypesFixer, StrictComparisonFixer, StrictParamFixer};
use Symplify\CodingStandard\Fixer\Commenting\RemoveDeadVarThisFixer;

/** @var \Symplify\EasyCodingStandard\Configuration\ECSConfigBuilder $builder */
$builder = require __DIR__ . '/vendor/php-forge/coding-standard/src/ecs-81.php';

// Preserve the extension's existing scalar coercion and comparison contracts in the distributed sources; tests declare
// strict types and keep explicit weak-comparison cases where the product contract relies on coercion.
return $builder
    ->withPaths(
        [
            __DIR__ . '/src',
            __DIR__ . '/tests',
        ],
    )
    ->withSkip(
        [
            DeclareStrictTypesFixer::class => [__DIR__ . '/src'],
            StrictComparisonFixer::class => [__DIR__ . '/src'],
            StrictParamFixer::class => [__DIR__ . '/src'],
            // Static analysis needs the `$this` type of view files.
            RemoveDeadVarThisFixer::class => [__DIR__ . '/tests/Support/Browser/views'],
        ],
    );
