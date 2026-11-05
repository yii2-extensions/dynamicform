<?php

declare(strict_types=1);

namespace Yii2\Extensions\DynamicForm\Tests\Support;

/**
 * Exposes `isNewRecord` through a getter, as ActiveRecord does, without requiring a database.
 */
final class RecordStateFormModel extends FormModel
{
    public function __construct(private readonly bool $newRecord, array $config = [])
    {
        parent::__construct($config);
    }

    public function getIsNewRecord(): bool
    {
        return $this->newRecord;
    }
}
