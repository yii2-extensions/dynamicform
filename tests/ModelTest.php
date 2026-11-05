<?php

declare(strict_types=1);

namespace Yii2\Extensions\DynamicForm\Tests;

use PHPUnit\Framework\Attributes\{DataProviderExternal, Group};
use Yii;
use yii\base\UnknownPropertyException;
use Yii2\Extensions\DynamicForm\Models\Model;
use Yii2\Extensions\DynamicForm\Tests\Provider\ModelProvider;
use Yii2\Extensions\DynamicForm\Tests\Support\{
    DottedKeyFormModel,
    EmptyFormNameModel,
    FormModel,
    KnownDefect,
    PersistedFormModel,
    TestCase,
};

use function array_filter;
use function array_keys;
use function array_search;
use function count;
use function get_class;
use function spl_object_id;

/**
 * Unit tests for {@see Model::createMultiple()} reusing existing models and creating new ones in submitted order.
 *
 * {@see ModelProvider} for test case data providers.
 */
#[Group('model')]
final class ModelTest extends TestCase
{
    /**
     * @param array<array-key, array<string, mixed>> $existing
     * @param array<array-key, mixed> $body
     * @param list<string> $expected
     */
    #[DataProviderExternal(ModelProvider::class, 'duplicateKeys')]
    public function testCreateMultipleCharacterizesDuplicateKeys(
        array $existing,
        array $body,
        string $pk,
        array $expected,
    ): void {
        $this->assertCreateMultiple($existing, $body, $pk, $expected);
    }

    /**
     * @param array<array-key, array<string, mixed>> $existing
     * @param array<array-key, mixed> $body
     * @param list<string> $expected
     */
    #[DataProviderExternal(ModelProvider::class, 'createMultiple')]
    public function testCreateMultipleMapsPostedRows(array $existing, array $body, string $pk, array $expected): void
    {
        $this->assertCreateMultiple($existing, $body, $pk, $expected);
    }

    /**
     * @param array<array-key, array<string, mixed>> $existing
     * @param array<array-key, mixed> $body
     * @param list<string> $expected
     */
    #[DataProviderExternal(ModelProvider::class, 'keyCoercion')]
    public function testCreateMultipleNormalizesKeysAsArrayKeys(
        array $existing,
        array $body,
        string $pk,
        array $expected,
    ): void {
        $this->assertCreateMultiple($existing, $body, $pk, $expected);
    }

    public function testCreateMultipleReadsNoRowsForAnEmptyFormName(): void
    {
        // Characterization: `loadMultiple()` reads top-level rows for an empty form name, `createMultiple()` does not.
        // The policy is undecided (plan Phase 3A); this case records the current result.
        Yii::$app->request->setBodyParams([['id' => 1], ['id' => 2]]);

        self::assertSame(
            [],
            Model::createMultiple(EmptyFormNameModel::class, [new EmptyFormNameModel(['id' => 1])]),
            'Top-level rows must not be read.',
        );
    }

    public function testCreateMultipleReadsRowsUnderTheFormNameOfTheRequestedClass(): void
    {
        $existing = new PersistedFormModel(['id' => 3]);

        Yii::$app->request->setBodyParams(
            [
                'FormModel' => [
                    ['id' => 3, 'name' => 'Posted'],
                    ['name' => 'Other'],
                ],
            ],
        );

        $models = Model::createMultiple(PersistedFormModel::class, [$existing]);

        self::assertSame(
            $existing,
            $models[0],
            'Existing row must be reused.',
        );
        self::assertSame(
            PersistedFormModel::class,
            get_class($models[1]),
            'New rows must use the requested class.',
        );
        self::assertSame(
            ['isNewRecord' => false, 'code' => null, 'id' => null, 'name' => ''],
            $models[1]->getAttributes(),
            'New rows must not be loaded.',
        );
        self::assertSame(
            ['isNewRecord' => false, 'code' => null, 'id' => 3, 'name' => ''],
            $existing->getAttributes(),
            'Reused rows must not be loaded.',
        );
    }

    #[Group('known-defect')]
    public function testCreateMultipleReusesExistingModelsByDottedPrimaryKey(): void
    {
        $existing = new DottedKeyFormModel(['meta' => ['id' => 7]]);

        Yii::$app->request->setBodyParams(['FormModel' => [['meta.id' => '7']]]);

        // Release 1.0.2 resolves `meta.id` on existing models with `ArrayHelper` and reuses the instance; the
        // current source reads it as a property name.
        KnownDefect::assertViolates(
            'F-13',
            UnknownPropertyException::class,
            'Getting unknown property: ' . DottedKeyFormModel::class . '::meta.id',
            static function () use ($existing): void {
                self::assertSame(
                    [$existing],
                    Model::createMultiple(DottedKeyFormModel::class, [$existing], 'meta.id'),
                    'Existing row must be reused.',
                );
            },
        );
    }

    /**
     * Calls `createMultiple()` and compares each returned model with the expected descriptor.
     *
     * @param array<array-key, array<string, mixed>> $existing
     * @param array<array-key, mixed> $body
     * @param list<string> $expected
     */
    private function assertCreateMultiple(array $existing, array $body, string $pk, array $expected): void
    {
        $models = [];

        foreach ($existing as $key => $attributes) {
            $models[$key] = new FormModel($attributes);
        }

        Yii::$app->request->setBodyParams($body);

        $result = Model::createMultiple(FormModel::class, $models, $pk);

        $actual = [];
        $created = [];

        foreach ($result as $model) {
            $key = array_search($model, $models, true);

            if ($key !== false) {
                $actual[] = "existing:{$key}";

                continue;
            }

            self::assertSame(
                FormModel::class,
                get_class($model),
                'New rows must use the requested class.',
            );
            self::assertSame(
                ['code' => null, 'id' => null, 'name' => ''],
                $model->getAttributes(),
                'New rows must not be loaded.',
            );

            $actual[] = 'new';

            $created[spl_object_id($model)] = true;
        }

        self::assertSame(
            array_keys($expected),
            array_keys($result),
            'Result must be a list.',
        );
        self::assertSame(
            $expected,
            $actual,
            'Rows must map to existing or new models in posted order.',
        );
        self::assertCount(
            count($created),
            array_filter($actual, static fn(string $descriptor): bool => $descriptor === 'new'),
            'Every new row must have its own instance.',
        );
    }
}
