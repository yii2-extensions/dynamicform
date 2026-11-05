<?php

declare(strict_types=1);

namespace Yii2\Extensions\DynamicForm\Tests\Support;

use yii\web\View;
use Yii2\Extensions\DynamicForm\DynamicFormWidget;

/**
 * Calls the protected hooks of {@see DynamicFormWidget} from a subclass, as application widgets do.
 */
final class InspectableDynamicFormWidget extends DynamicFormWidget
{
    public function callGetHashVarName(): mixed
    {
        return $this->getHashVarName();
    }

    public function callHashOptions(): void
    {
        $this->hashOptions();
    }

    public function callInitOptions(): void
    {
        $this->initOptions();
    }

    public function callRegisterOptions(View $view): void
    {
        $this->registerOptions($view);
    }
}
