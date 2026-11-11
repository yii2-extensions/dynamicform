<?php

declare(strict_types=1);

namespace Yii2\Extensions\DynamicForm\Tests;

use Testo\Assert;
use Testo\Data\DataProvider;
use Testo\Data\DataUnion;
use Testo\Filter\Group;
use Testo\Test;
use Yii;
use Yii2\Extensions\DynamicForm\Models\Model;
use Yii2\Extensions\DynamicForm\Tests\Provider\ModelProvider;
use Yii2\Extensions\DynamicForm\Tests\Support\{
    DottedKeyFormModel,
    EmptyFormNameModel,
    FormModel,
    PersistedFormModel,
    WebApplicationTrait,
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
#[Test]
#[Group('model')]
final class ModelTest
{
    use WebApplicationTrait;

    /**
     * Maps each posted row to an existing or a new model: the documented contract, duplicate keys and key coercion.
     *
     * @param array<array-key, array<string, mixed>> $existing
     * @param array<array-key, mixed> $body
     * @param list<string> $expected
     */
    #[DataUnion(
        new DataProvider(ModelProvider::class . '::createMultiple'),
        new DataProvider(ModelProvider::class . '::duplicateKeys'),
        new DataProvider(ModelProvider::class . '::keyCoercion'),
    )]
    public function createMultipleMapsPostedRows(array $existing, array $body, string $pk, array $expected): void
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

            Assert::same(
                get_class($model),
                FormModel::class,
                'New rows must use the requested class.',
            );
            Assert::same(
                $model->getAttributes(),
                ['code' => null, 'id' => null, 'name' => ''],
                'New rows must not be loaded.',
            );

            $actual[] = 'new';

            $created[spl_object_id($model)] = true;
        }

        Assert::same(
            array_keys($result),
            array_keys($expected),
            'Result must be a list.',
        );
        Assert::same(
            $actual,
            $expected,
            'Rows must map to existing or new models in posted order.',
        );
        Assert::count(
            array_filter($actual, static fn(string $descriptor): bool => $descriptor === 'new'),
            count($created),
            'Every new row must have its own instance.',
        );
    }

    public function createMultipleReadsNoRowsForAnEmptyFormName(): void
    {
        // Characterization: `loadMultiple()` reads top-level rows for an empty form name, `createMultiple()` does not.
        // The policy is undecided (plan Phase 3A); this case records the current result.
        Yii::$app->request->setBodyParams([['id' => 1], ['id' => 2]]);

        Assert::same(
            Model::createMultiple(EmptyFormNameModel::class, [new EmptyFormNameModel(['id' => 1])]),
            [],
            'Top-level rows must not be read.',
        );
    }

    public function createMultipleReadsRowsUnderTheFormNameOfTheRequestedClass(): void
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

        Assert::same(
            $models[0],
            $existing,
            'Existing row must be reused.',
        );
        Assert::same(
            get_class($models[1]),
            PersistedFormModel::class,
            'New rows must use the requested class.',
        );
        Assert::same(
            $models[1]->getAttributes(),
            ['isNewRecord' => false, 'code' => null, 'id' => null, 'name' => ''],
            'New rows must not be loaded.',
        );
        Assert::same(
            $existing->getAttributes(),
            ['isNewRecord' => false, 'code' => null, 'id' => 3, 'name' => ''],
            'Reused rows must not be loaded.',
        );
    }

    public function createMultipleReusesExistingModelsByDottedPrimaryKey(): void
    {
        $existing = new DottedKeyFormModel(['meta' => ['id' => 7]]);

        Yii::$app->request->setBodyParams(['FormModel' => [['meta.id' => '7']]]);

        Assert::same(
            Model::createMultiple(DottedKeyFormModel::class, [$existing], 'meta.id'),
            [$existing],
            'Existing row must be reused.',
        );
    }
}
