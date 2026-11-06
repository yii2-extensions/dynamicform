<?php

declare(strict_types=1);

namespace Yii2\Extensions\DynamicForm\Tests\Support;

/**
 * Represents a stored row with one attribute per kind of control a form reset restores.
 */
final class ControlsFormModel extends PersistedFormModel
{
    /**
     * @var string|null
     */
    public $flag;
    /**
     * @var string|null
     */
    public $kind;
    /**
     * @var string|null
     */
    public $level;
    /**
     * @var string|null
     */
    public $locked;
    /**
     * @var string|null
     */
    public $notes;
    /**
     * @var string|null
     */
    public $size;
    /**
     * @var string[]
     */
    public $tags = [];
}
