<?php

namespace Yii2\Extensions\DynamicForm;

use DOMDocument;
use Symfony\Component\DomCrawler\Crawler;
use Yii;
use yii\base\InvalidConfigException;
use yii\base\Model;
use yii\helpers\ArrayHelper;
use yii\helpers\Html;
use yii\helpers\Json;
use yii\web\View;

use function in_array;
use function is_array;
use function is_string;

/**
 * Yii2 Dynamic form widget for  cloning form elements in a nested manner while maintaining accessibility.
 */
class DynamicFormWidget extends \yii\base\Widget
{
    public const WIDGET_NAME = 'dynamicform';
    /**
     * @var string
     */
    public $deleteButton;
    /**
     * @var list<string>|null fields to be validated.
     */
    public $formFields;
    /**
     * @var string form ID
     */
    public $formId;
    /**
     * @var string
     */
    public $insertButton;
    /**
     * @var string 'bottom' or 'top';
     */
    public $insertPosition = 'bottom';
    /**
     * @var int
     */
    public $limit = 999;
    /**
     * @var int
     */
    public $min = 1;
    /**
     * @var Model|null the model used for the form
     */
    public $model;
    /**
     * @var string
     */
    public $widgetBody;
    /**
     * @var string
     */
    public $widgetContainer;
    /**
     * @var string
     */
    public $widgetItem;
    /**
     * @var string the Json encoded options.
     */
    private $_encodedOptions = '';
    /**
     * @var string the hashed global variable name storing the pluginOptions.
     */
    private $_hashVar;
    /**
     * @var list<string>
     */
    private $_insertPositions = ['bottom', 'top'];
    /**
     * @var array<string, mixed>
     */
    private $_options = [];

    /**
     * Initializes the widget.
     *
     * @throws InvalidConfigException
     *
     * @return void
     */
    public function init()
    {
        parent::init();

        if (self::isBlank($this->widgetContainer) || (preg_match('/^\w{1,}$/', $this->widgetContainer) === 0)) {
            throw new InvalidConfigException(
                'Invalid configuration to property "widgetContainer". Allowed only alphanumeric characters plus underline: [A-Za-z0-9_]',
            );
        }

        if (self::isBlank($this->widgetBody)) {
            throw new InvalidConfigException(
                "The 'widgetBody' property must be set.",
            );
        }

        if (self::isBlank($this->widgetItem)) {
            throw new InvalidConfigException(
                "The 'widgetItem' property must be set.",
            );
        }

        $this->model();

        if (self::isBlank($this->formId)) {
            throw new InvalidConfigException(
                "The 'formId' property must be set.",
            );
        }

        if (!in_array($this->insertPosition, $this->_insertPositions, true)) {
            throw new InvalidConfigException(
                "Invalid configuration to property 'insertPosition' (allowed values: 'bottom' or 'top')",
            );
        }

        $this->fields();
        $this->initOptions();
    }

    /**
     * Registers the needed assets.
     *
     * @param View $view The View object
     *
     * @return void
     */
    public function registerAssets($view)
    {
        DynamicFormAsset::register($view);

        // add a click handler for the clone button
        $js = <<<JS
            jQuery("#{$this->formId}").on("click", "{$this->insertButton}", function(e) {
                e.preventDefault();
                jQuery(".{$this->widgetContainer}").triggerHandler("beforeInsert", [jQuery(this)]);
                jQuery(".{$this->widgetContainer}").yiiDynamicForm("addItem", {$this->_hashVar}, e, jQuery(this));
            });

            JS;

        $view->registerJs($js, View::POS_READY);

        // add a click handler for the remove button
        $js = <<<JS
            jQuery("#{$this->formId}").on("click", "{$this->deleteButton}", function(e) {
                e.preventDefault();
                jQuery(".{$this->widgetContainer}").yiiDynamicForm("deleteItem", {$this->_hashVar}, e, jQuery(this));
            });

            JS;

        $view->registerJs($js, View::POS_READY);

        $js = <<<JS
            jQuery("#{$this->formId}").yiiDynamicForm({$this->_hashVar});

            JS;

        $view->registerJs($js, View::POS_LOAD);
    }

    /**
     * Register the actual widget.
     *
     * @return bool
     */
    public function registerHashVarWidget()
    {
        if ($this->registeredHashVar() !== null) {
            return false;
        }

        $registry = Yii::$app->params[self::WIDGET_NAME] ?? [];

        $registry = is_array($registry) ? $registry : [];

        $registry[$this->widgetContainer] = $this->_hashVar;

        Yii::$app->params[self::WIDGET_NAME] = $registry;

        return true;
    }

    public function run()
    {
        $content = (string) ob_get_clean();

        $crawler = new Crawler();

        $crawler->addHtmlContent($content, \Yii::$app->charset);

        $results = $crawler->filter($this->widgetItem);
        $template = $results->first()->getNode(0);

        if ($template === null) {
            throw new InvalidConfigException(
                'The "widgetItem" selector must match at least one template item.',
            );
        }

        $document = new DOMDocument('1.0', Yii::$app->charset);

        $document->appendChild($document->importNode($template, true));

        $this->_options['template'] = trim((string) $document->saveHTML());

        if ($this->min === 0 && $this->isNewRecord()) {
            $content = $this->removeItems($content);
        }

        $this->hashOptions();

        $view = $this->getView();
        $widgetRegistered = $this->registerHashVarWidget();
        $this->_hashVar = $this->getHashVarName();

        if ($widgetRegistered) {
            $this->registerOptions($view);
            $this->registerAssets($view);
        }

        echo Html::tag('div', $content, ['class' => $this->widgetContainer, 'data-dynamicform' => $this->_hashVar]);
    }

    /**
     * Returns the hashed variable.
     *
     * @return string
     */
    protected function getHashVarName()
    {
        return $this->registeredHashVar() ?? $this->_hashVar;
    }

    /**
     * Generates a hashed variable to store the options.
     *
     * @return void
     */
    protected function hashOptions()
    {
        $this->_encodedOptions = Json::htmlEncode($this->_options);
        $this->_hashVar = self::WIDGET_NAME . '_' . hash('crc32', $this->_encodedOptions);
    }

    /**
     * Initializes the widget options.
     *
     * @return void
     */
    protected function initOptions()
    {
        $this->_options['widgetContainer'] = $this->widgetContainer;
        $this->_options['widgetBody'] = $this->widgetBody;
        $this->_options['widgetItem'] = $this->widgetItem;
        $this->_options['limit'] = $this->limit;
        $this->_options['insertButton'] = $this->insertButton;
        $this->_options['deleteButton'] = $this->deleteButton;
        $this->_options['insertPosition'] = $this->insertPosition;
        $this->_options['formId'] = $this->formId;
        $this->_options['min'] = $this->min;
        $this->_options['fields'] = [];

        $model = $this->model();

        foreach ($this->fields() as $field) {
            $this->_options['fields'][] = [
                'id' => Html::getInputId($model, '[{}]' . $field),
                'name' => Html::getInputName($model, '[{}]' . $field),
            ];
        }

        ob_start();
        ob_implicit_flush(false);
    }

    /**
     * Registers plugin options by storing it in a hashed javascript variable.
     *
     * @param View $view The View object
     *
     * @return void
     */
    protected function registerOptions($view)
    {
        $view->registerJs("var {$this->_hashVar} = {$this->_encodedOptions};\n", View::POS_HEAD);
    }

    /**
     * Returns the validated fields.
     *
     * @throws InvalidConfigException When `formFields` is not a non-empty list.
     *
     * @return list<string>
     */
    private function fields(): array
    {
        if (!is_array($this->formFields) || $this->formFields === []) {
            throw new InvalidConfigException("The 'formFields' property must be set.");
        }

        return $this->formFields;
    }

    /**
     * Returns whether a required string option is missing or blank.
     */
    private static function isBlank(mixed $value): bool
    {
        return !is_string($value) || $value === '';
    }

    /**
     * Returns whether the row model is a new record; models without the property count as new.
     */
    private function isNewRecord(): bool
    {
        $model = $this->model();

        if (!$model->canGetProperty('isNewRecord')) {
            return true;
        }

        return (bool) ArrayHelper::getValue($model, 'isNewRecord');
    }

    /**
     * Returns the validated row model.
     *
     * @throws InvalidConfigException When `model` is not a {@see Model}.
     */
    private function model(): Model
    {
        if (!$this->model instanceof Model) {
            throw new InvalidConfigException("The 'model' property must be set and must extend from '\\yii\\base\\Model'.");
        }

        return $this->model;
    }

    /**
     * Returns the variable name registered for the container by the first widget rendered with it, or `null`.
     *
     * @return string|null
     */
    private function registeredHashVar()
    {
        $registry = Yii::$app->params[self::WIDGET_NAME] ?? null;
        $hashVar = is_array($registry) ? ($registry[$this->widgetContainer] ?? null) : null;

        return is_string($hashVar) ? $hashVar : null;
    }

    /**
     * Clear HTML widgetBody. Required to work with zero or more items.
     *
     * @param string $content
     *
     * @return string
     */
    private function removeItems($content)
    {
        $crawler = new Crawler();

        $crawler->addHtmlContent($content, Yii::$app->charset);
        $crawler->filter(
            $this->widgetItem
        )->each(
            function ($nodes) {
                foreach ($nodes as $node) {
                    $node->parentNode?->removeChild($node);
                }
            },
        );

        return $crawler->filter('body')->html();
    }
}
