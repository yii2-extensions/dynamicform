<?php

namespace Yii2\Extensions\DynamicForm;

use DOMDocument;
use Symfony\Component\DomCrawler\Crawler;
use WeakMap;
use Yii;
use yii\base\InvalidConfigException;
use yii\base\Model;
use yii\helpers\ArrayHelper;
use yii\helpers\Html;
use yii\helpers\Json;
use yii\web\View;

use function array_diff_key;
use function array_intersect_key;
use function implode;
use function in_array;
use function is_array;
use function is_string;

/**
 * Yii2 Dynamic form widget for cloning form elements in a nested manner while maintaining accessibility.
 *
 * A widget is registered once per page, form and container: its options, click handlers and initialization are
 * declared by the first rendering, and later renderings with the same `formId` and `widgetContainer` in the same page,
 * such as a nested widget rendered once per outer row, reuse that registration. They must serialize the same options
 * except the row template; a different configuration under the same container of the same form is rejected. The page
 * ends when the view is cleared, as {@see View::endPage()} and {@see View::renderAjax()} do.
 *
 * @phpstan-type Registration array{hashVar: string, options: array<string, mixed>}
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
     * Registrations of the current page of each view, by registration key.
     *
     * Entries of a view whose page was cleared are ignored; see {@see registration()}.
     *
     * @var WeakMap<\yii\base\View, array<string, Registration>>|null
     */
    private static WeakMap|null $registrations = null;

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

        if (self::isBlank($this->widgetContainer) || (preg_match('/^\w{1,}$/D', $this->widgetContainer) === 0)) {
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
     * The click handlers are delegated from the form and act only when the clicked button belongs directly to a
     * container of this registration, so widgets that share button selectors, such as nested widgets, never act on
     * each other's rows. `beforeInsert` is triggered on that container with the button; it is informational and cannot
     * cancel the insertion.
     *
     * @param View $view The View object
     *
     * @return void
     */
    public function registerAssets($view)
    {
        DynamicFormAsset::register($view);

        // add a click handler for the clone button
        $view->registerJs(
            $this->clickHandler(
                $this->insertButton,
                [
                    '$container.triggerHandler("beforeInsert", [jQuery(this)]);',
                    "\$container.yiiDynamicForm(\"addItem\", {$this->_hashVar}, e, jQuery(this));",
                ],
            ),
            View::POS_READY,
        );

        // add a click handler for the remove button
        $view->registerJs(
            $this->clickHandler(
                $this->deleteButton,
                ["\$container.yiiDynamicForm(\"deleteItem\", {$this->_hashVar}, e, jQuery(this));"],
            ),
            View::POS_READY,
        );

        $view->registerJs("{$this->formJs()}.yiiDynamicForm({$this->_hashVar});\n", View::POS_LOAD);
    }

    /**
     * Registers the widget for its form and container in the current page of the view.
     *
     * Call it after {@see hashOptions()}. The registration stays in effect while the page holds the options declared by
     * {@see registerOptions()}.
     *
     * @throws InvalidConfigException When the page already holds a registration for the same form and container whose
     * options, other than the row template, differ.
     *
     * @return bool `true` when the widget was registered, `false` when the page already holds a compatible registration.
     */
    public function registerHashVarWidget()
    {
        $registration = $this->registration();

        if ($registration !== null) {
            $this->assertCompatible($registration['options']);

            return false;
        }

        $view = $this->getView();

        $registrations = self::$registrations ??= new WeakMap();

        // Keep only the registrations whose options the current page still declares, so a view reused for many pages
        // does not accumulate the registrations of ended pages.
        $scripts = $view->js[View::POS_HEAD] ?? [];
        $page = is_array($scripts) ? array_intersect_key($registrations[$view] ?? [], $scripts) : [];

        $page[$this->registrationKey()] = [
            'hashVar' => $this->_hashVar,
            'options' => $this->comparableOptions(),
        ];

        $registrations[$view] = $page;

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
     * Returns the hashed variable: the one registered for the form and container in the current page, if any.
     *
     * @return string
     */
    protected function getHashVarName()
    {
        return $this->registration()['hashVar'] ?? $this->_hashVar;
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
        $view->registerJs(
            "var {$this->_hashVar} = {$this->_encodedOptions};\n",
            View::POS_HEAD,
            $this->registrationKey(),
        );
    }

    /**
     * Throws when the options of this widget, other than the row template, differ from a registered configuration.
     *
     * @param array<string, mixed> $registered Comparable options of the registration.
     *
     * @throws InvalidConfigException When at least one option differs; the message lists them in serialization order.
     */
    private function assertCompatible(array $registered): void
    {
        $differences = [];

        foreach ($this->comparableOptions() as $name => $value) {
            if (($registered[$name] ?? null) !== $value) {
                $differences[] = $name === 'fields' ? 'formFields' : $name;
            }
        }

        if ($differences !== []) {
            throw new InvalidConfigException(
                "The \"widgetContainer\" \"{$this->widgetContainer}\" is already registered in the form "
                . "\"{$this->formId}\" with different options: " . implode(', ', $differences)
                . '. Widgets sharing a container in one form must use the same options.',
            );
        }
    }

    /**
     * Returns a delegated click handler that runs the statements on the container that owns the clicked button.
     *
     * The owner is the nearest dynamic-form container around the button; the statements run only when it references
     * this widget's options variable, available to them as `$container`.
     *
     * @param string|null $selector CSS selector of the buttons; `null` binds the handler to the form itself, as an
     * empty selector does.
     * @param list<string> $statements JavaScript statements to run on the owning container.
     *
     * @return string JavaScript statement that installs the handler.
     */
    private function clickHandler(string|null $selector, array $statements): string
    {
        $encodedSelector = Json::htmlEncode($selector);
        $encodedHashVar = Json::htmlEncode($this->_hashVar);
        $body = implode("\n        ", $statements);

        return <<<JS
            {$this->formJs()}.on("click", {$encodedSelector}, function(e) {
                e.preventDefault();
                var \$container = jQuery(this).closest("div[data-dynamicform]");
                if (\$container.attr("data-dynamicform") === {$encodedHashVar}) {
                    {$body}
                }
            });

            JS;
    }

    /**
     * Returns the options compared between renderings of one registration: all of them except the row template.
     *
     * @return array<string, mixed>
     */
    private function comparableOptions(): array
    {
        return array_diff_key($this->_options, ['template' => true]);
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
     * Returns the JavaScript expression that selects the form by its JSON-encoded `id`.
     */
    private function formJs(): string
    {
        return 'jQuery(document.getElementById(' . Json::htmlEncode($this->formId) . '))';
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
            throw new InvalidConfigException(
                "The 'model' property must be set and must extend from '\\yii\\base\\Model'.",
            );
        }

        return $this->model;
    }

    /**
     * Returns the registration of the form and container in the current page of the view, or `null`.
     *
     * A registration belongs to the page that declares its options under {@see registrationKey()}; once the view is
     * cleared, by {@see View::endPage()}, {@see View::renderAjax()} or {@see View::clear()}, it no longer applies.
     *
     * @phpstan-return Registration|null
     */
    private function registration(): array|null
    {
        $view = $this->getView();
        $key = $this->registrationKey();
        $registration = (self::$registrations[$view] ?? [])[$key] ?? null;
        $scripts = $view->js[View::POS_HEAD] ?? null;

        return is_array($scripts) && isset($scripts[$key]) ? $registration : null;
    }

    /**
     * Returns the key that identifies the registration of the form and container in a page.
     *
     * `widgetContainer` contains no `/`, so the key is unambiguous for any form id.
     */
    private function registrationKey(): string
    {
        return self::WIDGET_NAME . "/{$this->formId}/{$this->widgetContainer}";
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
