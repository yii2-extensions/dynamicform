<?php

declare(strict_types=1);

namespace Yii2\Extensions\DynamicForm\Tests\Support;

/**
 * Stores its primary key inside an array property, addressed by the dotted key `meta.id`.
 */
final class DottedKeyFormModel extends FormModel
{
    /**
     * @var array<string, int|string|null>
     */
    public $meta = ['id' => null];
}
