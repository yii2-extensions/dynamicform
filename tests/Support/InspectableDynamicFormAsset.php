<?php

declare(strict_types=1);

namespace Yii2\Extensions\DynamicForm\Tests\Support;

use Yii2\Extensions\DynamicForm\DynamicFormAsset;

/**
 * Calls the protected hooks of {@see DynamicFormAsset} from a subclass, as application bundles do.
 */
final class InspectableDynamicFormAsset extends DynamicFormAsset
{
    public function callSetSourcePath(string $path): void
    {
        $this->setSourcePath($path);
    }

    /**
     * @param list<string> $files
     */
    public function callSetupAssets(string $type, array $files): void
    {
        $this->setupAssets($type, $files);
    }
}
