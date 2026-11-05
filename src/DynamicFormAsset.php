<?php

namespace Yii2\Extensions\DynamicForm;

/**
 * Asset bundle for Dynamic form Widget
 */
class DynamicFormAsset extends \yii\web\AssetBundle
{
    public $depends = [
        'yii\web\JqueryAsset',
        'yii\widgets\ActiveFormAsset',
    ];

    /**
     * @return void
     */
    public function init()
    {
        $this->setSourcePath(__DIR__ . '/assets');
        $this->setupAssets('js', ['yii2-dynamic-form']);

        parent::init();
    }

    /**
     * Sets the source path if empty
     *
     * @param string $path the path to be set
     *
     * @return void
     */
    protected function setSourcePath($path)
    {
        if ($this->sourcePath === null || $this->sourcePath === '') {
            $this->sourcePath = $path;
        }
    }

    /**
     * Set up CSS and JS asset arrays based on the base-file names
     *
     * @param string $type whether 'css' or 'js'
     * @param list<string> $files the list of 'css' or 'js' basefile names
     *
     * @return void
     */
    protected function setupAssets($type, $files = [])
    {
        $suffix = YII_DEBUG ? '' : '.min';

        $selected = array_map(static fn(string $file): string => "{$file}{$suffix}.{$type}", $files);

        if ($type === 'css' && $this->css === []) {
            $this->css = $selected;
        } elseif ($type === 'js' && $this->js === []) {
            $this->js = $selected;
        }
    }
}
