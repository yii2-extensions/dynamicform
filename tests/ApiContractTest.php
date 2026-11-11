<?php

declare(strict_types=1);

namespace Yii2\Extensions\DynamicForm\Tests;

use Testo\Assert;
use Testo\Data\DataProvider;
use Testo\Filter\Group;
use Testo\Test;
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
#[Test]
#[Group('api')]
final class ApiContractTest
{
    /**
     * @param class-string $class
     * @param array<string, string> $expected
     */
    #[DataProvider(ApiContractProvider::class . '::releasedApi')]
    public function declaredMembersMatchTheReleasedApi(string $class, array $expected): void
    {
        Assert::same(
            ApiSignature::describe($class),
            $expected,
            'Members must keep the 1.0.2 signatures.',
        );
    }
}
