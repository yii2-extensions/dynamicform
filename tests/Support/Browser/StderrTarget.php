<?php

declare(strict_types=1);

namespace Yii2\Extensions\DynamicForm\Tests\Support\Browser;

use yii\log\Target;

/**
 * Writes fixture errors to the PHP server log, including when `YII_DEBUG` is `false`.
 */
final class StderrTarget extends Target
{
    public function export(): void
    {
        foreach ($this->messages as $message) {
            error_log($this->formatMessage($message));
        }
    }
}
