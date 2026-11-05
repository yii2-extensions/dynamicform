<?php

declare(strict_types=1);

namespace Yii2\Extensions\DynamicForm\Tests\Support;

use yii\base\Model;

/**
 * Provides editable fields without requiring a database.
 *
 * Rows are posted under `FormModel` whatever the subclass, unless {@see setFormName()} selects another name.
 */
class FormModel extends Model
{
    /**
     * @var int|string|null
     */
    public $code;
    /**
     * @var int|string|null
     */
    public $id;
    /**
     * @var string
     */
    public $name = '';
    private string $formName = 'FormModel';

    public function formName(): string
    {
        return $this->formName;
    }

    public function rules()
    {
        return [[['name'], 'required']];
    }

    /**
     * Sets the name the rows are posted under, so one class can stand for several models on a page.
     */
    public function setFormName(string $formName): void
    {
        $this->formName = $formName;
    }
}
