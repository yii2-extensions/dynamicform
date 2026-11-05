<?php

declare(strict_types=1);

namespace Yii2\Extensions\DynamicForm\Tests;

use PHPUnit\Framework\Attributes\{DataProviderExternal, Group};
use PHPUnit\Framework\TestCase;
use Yii2\Extensions\DynamicForm\Tests\Provider\ApiContractProvider;
use Yii2\Extensions\DynamicForm\Tests\Support\ApiSignature;

/**
 * Unit tests for the public and protected API of {@see \Yii2\Extensions\DynamicForm\DynamicFormWidget},
 * {@see \Yii2\Extensions\DynamicForm\DynamicFormAsset} and {@see \Yii2\Extensions\DynamicForm\Models\Model}.
 *
 * Visibility, parameters, defaults and the absence of native types are part of the contract that overriding
 * applications rely on.
 *
 * {@see ApiContractProvider} for test case data providers.
 */
#[Group('api')]
final class ApiContractTest extends TestCase
{
    /**
     * @param class-string $class
     * @param array<string, string> $expected
     */
    #[DataProviderExternal(ApiContractProvider::class, 'releasedApi')]
    public function testDeclaredMembersMatchTheReleasedApi(string $class, array $expected): void
    {
        self::assertSame(
            $expected,
            ApiSignature::describe($class),
            'Members must keep the 1.0.2 signatures.',
        );
    }
}
