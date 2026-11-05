<?php

declare(strict_types=1);

namespace Yii2\Extensions\DynamicForm\Tests\Support;

use Throwable;
use Yii2\Extensions\DynamicForm\DynamicFormWidget;

use function array_replace;
use function ob_end_clean;
use function ob_get_clean;
use function ob_get_level;
use function ob_start;

/**
 * Renders {@see DynamicFormWidget} through the real `begin()`/`end()` widget stack.
 *
 * Only the buffer opened here is closed when rendering fails; a buffer or stack entry left by the widget itself is
 * reported by {@see TestCase::tearDown()}.
 */
final class WidgetRenderer
{
    public const DEFAULT_CONTENT = '<div class="items"><div class="item">Row</div></div>';

    /**
     * Returns the minimal valid widget configuration.
     *
     * @return array<string, mixed>
     */
    public static function config(): array
    {
        return [
            'widgetContainer' => 'dynamic_form',
            'widgetBody' => '.items',
            'widgetItem' => '.item',
            'insertButton' => '.add',
            'deleteButton' => '.remove',
            'formId' => 'test-form',
            'model' => new FormModel(),
            'formFields' => ['name'],
        ];
    }

    /**
     * Renders the widget around the content and returns the produced markup.
     *
     * @param array<string, mixed> $overrides Configuration replacing the defaults of {@see config()}.
     * @param string $content Markup echoed between `begin()` and `end()`.
     *
     * @throws Throwable Whatever the widget throws, after closing the buffer opened here.
     */
    public static function render(array $overrides = [], string $content = self::DEFAULT_CONTENT): string
    {
        $level = ob_get_level();

        ob_start();

        try {
            DynamicFormWidget::begin(array_replace(self::config(), $overrides));

            echo $content;

            DynamicFormWidget::end();
        } catch (Throwable $exception) {
            if (ob_get_level() === $level + 1) {
                ob_end_clean();
            }

            throw $exception;
        }

        return (string) ob_get_clean();
    }
}
