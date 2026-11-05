<?php

declare(strict_types=1);

namespace Yii2\Extensions\DynamicForm\Tests\Support;

/**
 * Represents an already stored row without requiring a database.
 */
class PersistedFormModel extends FormModel
{
    /**
     * @var bool
     */
    public $isNewRecord = false;
}
