<?php

declare(strict_types=1);

namespace Yii2\Extensions\DynamicForm\Tests\Support;

/**
 * Represents a stored row edited through Kartik DatePicker controls.
 *
 * `name` and `date` are required; `due` and `start` are optional.
 */
final class DatePickerFormModel extends PersistedFormModel
{
    /**
     * @var string|null
     */
    public $date;
    /**
     * @var string|null
     */
    public $due;
    /**
     * @var string|null
     */
    public $start;

    public function rules()
    {
        return [
            [['name', 'date'], 'required'],
            [['due', 'start'], 'safe'],
        ];
    }
}
