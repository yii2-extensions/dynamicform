<?php

declare(strict_types=1);

namespace Yii2\Extensions\DynamicForm\Tests\Support;

use Closure;
use PHPUnit\Framework\Assert;
use Throwable;

use function getenv;
use function str_contains;

/**
 * Runs the assertions of a correct contract that a known, recorded defect currently violates.
 */
final class KnownDefect
{
    /**
     * @param string $id Defect identifier in the private defect record (for example `F-13`).
     * @param class-string<Throwable> $failure Class of the failure the defect currently produces.
     * @param string $message Fragment of the failure message that identifies the defect.
     * @param Closure(): void $contract Assertions of the correct behavior.
     */
    public static function assertViolates(string $id, string $failure, string $message, Closure $contract): void
    {
        if (getenv('DYNAMICFORM_STRICT_DEFECTS') === '1') {
            $contract();

            return;
        }

        try {
            $contract();
        } catch (Throwable $exception) {
            if (!$exception instanceof $failure || !str_contains($exception->getMessage(), $message)) {
                throw $exception;
            }

            Assert::assertInstanceOf(
                $failure,
                $exception,
                "Defect {$id} must fail with its recorded signature.",
            );

            return;
        }

        Assert::fail(
            "Known defect {$id} no longer reproduces; update the test and the defect record with the fix.",
        );
    }
}
