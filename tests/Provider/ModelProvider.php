<?php

declare(strict_types=1);

namespace Yii2\Extensions\DynamicForm\Tests\Provider;

/**
 * Data provider for {@see \Yii2\Extensions\DynamicForm\Tests\ModelTest} test cases.
 *
 * @phpstan-type CreateMultipleCase array{
 *   array<array-key, array<string, mixed>>,
 *   array<array-key, mixed>,
 *   string,
 *   list<string>
 * }
 */
final class ModelProvider
{
    /**
     * Cases whose result is the documented contract.
     *
     * @return iterable<string, CreateMultipleCase>
     */
    public static function createMultiple(): iterable
    {
        yield 'missing payload' => [
            [['id' => 1]],
            [],
            'id',
            [],
        ];
        yield 'scalar payload' => [
            [['id' => 1]],
            ['FormModel' => 'invalid'],
            'id',
            [],
        ];
        yield 'empty row list' => [
            [['id' => 1]],
            ['FormModel' => []],
            'id',
            [],
        ];
        yield 'unsaved rows without key' => [
            [[], []],
            ['FormModel' => [['name' => 'First'], ['name' => 'Second']]],
            'id',
            ['new', 'new'],
        ];
        yield 'custom primary key keeps posted order' => [
            [['code' => 'alpha'], ['code' => 'beta']],
            ['FormModel' => [['code' => 'beta'], ['code' => 'new'], ['code' => 'alpha']]],
            'code',
            ['existing:1', 'new', 'existing:0'],
        ];
        yield 'unknown key' => [
            [['id' => 1]],
            ['FormModel' => [['id' => 2]]],
            'id',
            ['new'],
        ];
        yield 'existing model keys are not significant' => [
            ['first' => ['id' => 2]],
            ['FormModel' => [['id' => 2]]],
            'id',
            ['existing:first'],
        ];
        yield 'sparse posted indexes become a list' => [
            [['id' => 5]],
            ['FormModel' => [7 => ['id' => 5], 3 => ['id' => 9]]],
            'id',
            ['existing:0', 'new'],
        ];
        yield 'string posted indexes become a list' => [
            [['id' => 'a']],
            ['FormModel' => ['x' => ['id' => 'a'], 'y' => []]],
            'id',
            ['existing:0', 'new'],
        ];
        yield 'empty string key never matches' => [
            [['id' => '']],
            ['FormModel' => [['id' => '']]],
            'id',
            ['new'],
        ];
        yield 'null keys never match' => [
            [['id' => null], ['id' => null]],
            ['FormModel' => [['id' => null], []]],
            'id',
            ['new', 'new'],
        ];
        yield 'array key is malformed' => [
            [['id' => 1]],
            ['FormModel' => [['id' => ['1']]]],
            'id',
            ['new'],
        ];
        yield 'scalar row is malformed' => [
            [['id' => 1]],
            ['FormModel' => ['invalid', ['id' => 1]]],
            'id',
            ['new', 'existing:0'],
        ];
        yield 'boolean key is malformed' => [
            [['id' => 1]],
            ['FormModel' => [['id' => true]]],
            'id',
            ['new'],
        ];
        yield 'float key is malformed' => [
            [['id' => 1]],
            ['FormModel' => [['id' => 1.0]]],
            'id',
            ['new'],
        ];
    }

    /**
     * Current behavior for duplicate keys; the duplicate-key policy is undecided (audit F06), so these cases
     * characterize rather than approve it.
     *
     * @return iterable<string, CreateMultipleCase>
     */
    public static function duplicateKeys(): iterable
    {
        yield 'duplicate existing keys keep the last model' => [
            [['id' => 1], ['id' => 1]],
            ['FormModel' => [['id' => 1]]],
            'id',
            ['existing:1'],
        ];
        yield 'repeated posted key reuses one instance' => [
            [['id' => 1]],
            ['FormModel' => [['id' => 1], ['id' => '1']]],
            'id',
            ['existing:0', 'existing:0'],
        ];
    }

    /**
     * @return iterable<string, CreateMultipleCase>
     */
    public static function keyCoercion(): iterable
    {
        yield 'integer zero posted as string' => [
            [['id' => 0]],
            ['FormModel' => [['id' => '0']]],
            'id',
            ['existing:0'],
        ];
        yield 'string zero posted as integer' => [
            [['id' => '0']],
            ['FormModel' => [['id' => 0]]],
            'id',
            ['existing:0'],
        ];
        yield 'integer posted as decimal string' => [
            [['id' => 10]],
            ['FormModel' => [['id' => '10']]],
            'id',
            ['existing:0'],
        ];
        yield 'leading zero is a different key' => [
            [['id' => 10]],
            ['FormModel' => [['id' => '010']]],
            'id',
            ['new'],
        ];
        yield 'signed string is a different key' => [
            [['id' => 10]],
            ['FormModel' => [['id' => '+10']]],
            'id',
            ['new'],
        ];
    }
}
