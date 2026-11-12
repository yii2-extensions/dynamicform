<?php

declare(strict_types=1);

use PhpCsFixer\Fixer\Whitespace\{HeredocIndentationFixer, NoExtraBlankLinesFixer};
use PhpCsFixer\Fixer\Phpdoc\PhpdocNoEmptyReturnFixer;
use PhpCsFixer\Fixer\Strict\{DeclareStrictTypesFixer, StrictComparisonFixer, StrictParamFixer};
use Symplify\CodingStandard\Fixer\Commenting\RemoveDeadVarThisFixer;

/** @var \Symplify\EasyCodingStandard\Configuration\ECSConfigBuilder $builder */
$builder = require __DIR__ . '/vendor/php-forge/coding-standard/src/ecs-83.php';

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
            HeredocIndentationFixer::class,
            NoExtraBlankLinesFixer::class,
            PhpdocNoEmptyReturnFixer::class => [__DIR__ . '/src'],
            RemoveDeadVarThisFixer::class => [__DIR__ . '/tests/Support/Browser/views'],
            StrictComparisonFixer::class => [__DIR__ . '/src'],
            StrictParamFixer::class => [__DIR__ . '/src'],
        ],
    );
