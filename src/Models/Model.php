<?php

namespace Yii2\Extensions\DynamicForm\Models;

use Yii;
use yii\helpers\ArrayHelper;

use function is_array;
use function is_int;
use function is_string;

class Model extends \yii\base\Model
{
    /**
     * Creates or reuses models in submitted order; call loadMultiple() to populate attributes.
     *
     * @template T of \yii\base\Model
     * @param class-string<T> $modelClass
     * @param array<array-key, T> $multipleModels
     * @param string $pk
     * @return list<T>
     */
    public static function createMultiple($modelClass, $multipleModels = [], $pk = 'id')
    {
        $model = new $modelClass();

        $formName = $model->formName();

        $post = Yii::$app->request->post($formName);

        $models = [];

        $indexedModels = [];
        foreach ($multipleModels as $existingModel) {
            $key = ArrayHelper::getValue($existingModel, $pk);

            if (is_int($key) || is_string($key)) {
                $indexedModels[$key] = $existingModel;
            }
        }

        if (is_array($post)) {
            foreach ($post as $item) {
                $key = is_array($item) ? ArrayHelper::getValue($item, $pk) : null;

                if ((is_int($key) || is_string($key)) && $key !== '' && isset($indexedModels[$key])) {
                    $models[] = $indexedModels[$key];
                } else {
                    $models[] = new $modelClass();
                }
            }
        }

        return $models;
    }
}
