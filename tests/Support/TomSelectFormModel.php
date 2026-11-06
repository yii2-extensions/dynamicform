<?php

declare(strict_types=1);

namespace Yii2\Extensions\DynamicForm\Tests\Support;

/**
 * Represents a stored row edited through TomSelect, Kartik Select2 and plain select controls.
 *
 * `kind` (single TomSelect with an empty prompt option) and `name` are required; `tags` (multiple TomSelect with
 * option groups), `color` (plain select) and `level` (Kartik Select2) are optional.
 */
final class TomSelectFormModel extends PersistedFormModel
{
    /**
     * @var string|null
     */
    public $color;
    /**
     * @var string|null
     */
    public $kind;
    /**
     * @var string|null
     */
    public $level;
    /**
     * @var string[]
     */
    public $tags = [];

    public function rules()
    {
        return [[['name', 'kind'], 'required'], [['tags', 'color', 'level'], 'safe']];
    }
}
