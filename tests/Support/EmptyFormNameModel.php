<?php

declare(strict_types=1);

namespace Yii2\Extensions\DynamicForm\Tests\Support;

/**
 * Reads tabular rows from the top level of the request body, as an empty `formName()` does in Yii.
 */
final class EmptyFormNameModel extends FormModel
{
    public function formName(): string
    {
        return '';
    }
}
