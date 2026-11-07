<?php

declare(strict_types=1);

namespace Yii2\Extensions\DynamicForm\Tests\Support;

/**
 * Represents a stored row edited through Yii `MaskedInput` controls.
 *
 * `name` and `phone` are required and `phone` must match its mask; `code` is optional.
 */
final class InputmaskFormModel extends PersistedFormModel
{
    /**
     * @var string|null
     */
    public $phone;

    public function rules()
    {
        return [
            [['name', 'phone'], 'required'],
            [['phone'], 'match', 'pattern' => '/^\d{3}-\d{4}$/'],
            [['code'], 'safe'],
        ];
    }
}
