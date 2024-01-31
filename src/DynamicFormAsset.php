<?php

/**
 * @link      https://github.com/yii2-extensions/dynamicform
 * @copyright Copyright (c) 2014  - 2024 Wanderson Bragança, Yii community, et al
 * @license   https://github.com/yii2-extensions/dynamicform/blob/master/LICENSE
 */

namespace Yii2\Extensions\DynamicForm;

/**
 * Asset bundle for Dynamic form Widget
 *
 * @author Wanderson Bragança <wanderson.wbc@gmail.com>
 * @author Stefano Mtangoo <mwinjilisti@gmail.com>
 */
class DynamicFormAsset extends \yii\web\AssetBundle
{
    /**
     * @inheritdoc
     */
    public $depends = [
        'yii\web\JqueryAsset',
        'yii\widgets\ActiveFormAsset'
    ];

    /**
     * Set up CSS and JS asset arrays based on the base-file names
     * @param string $type whether 'css' or 'js'
     * @param array $files the list of 'css' or 'js' basefile names
     */
    protected function setupAssets($type, $files = [])
    {
        $srcFiles = [];
        $minFiles = [];
        foreach ($files as $file) {
            $srcFiles[] = "{$file}.{$type}";
            $minFiles[] = "{$file}.min.{$type}";
        }
        if (empty($this->$type)) {
            $this->$type = YII_DEBUG ? $srcFiles : $minFiles;
        }
    }

    /**
     * @inheritdoc
     */
    public function init()
    {
        $this->setSourcePath(__DIR__ . '/assets');
        $this->setupAssets('js', ['yii2-dynamic-form']);
        parent::init();
    }

    /**
     * Sets the source path if empty
     * @param string $path the path to be set
     */
    protected function setSourcePath($path)
    {
        if (empty($this->sourcePath)) {
            $this->sourcePath = $path;
        }
    }
}
