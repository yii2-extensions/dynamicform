<?php

declare(strict_types=1);

namespace Yii2\Extensions\DynamicForm\Tests;

use Closure;
use ReflectionProperty;
use Testo\Assert;
use Testo\Data\DataProvider;
use Testo\Filter\Group;
use Testo\Test;
use WeakMap;
use Yii;
use yii\base\{InvalidCallException, InvalidConfigException};
use yii\helpers\Json;
use yii\web\{JqueryAsset, View, YiiAsset};
use yii\widgets\ActiveFormAsset;
use Yii2\Extensions\DynamicForm\{DynamicFormAsset, DynamicFormWidget};
use Yii2\Extensions\DynamicForm\Tests\Provider\DynamicFormWidgetProvider;
use Yii2\Extensions\DynamicForm\Tests\Support\{
    FormModel,
    InspectableDynamicFormWidget,
    WebApplicationTrait,
    WidgetRenderer,
};

use function array_keys;
use function array_replace;
use function array_slice;
use function array_values;
use function count;
use function html_entity_decode;
use function mb_strlen;
use function ob_end_clean;
use function ob_get_level;
use function ord;
use function preg_match;
use function preg_replace_callback;
use function sort;
use function sprintf;

use const ENT_HTML5;
use const ENT_QUOTES;

/**
 * Unit tests for {@see DynamicFormWidget} rendering, option serialization, script registration and configuration.
 *
 * {@see DynamicFormWidgetProvider} for test case data providers.
 */
#[Test]
#[Group('widget')]
final class DynamicFormWidgetTest
{
    use WebApplicationTrait;

    /**
     * Options of {@see WidgetRenderer::config()} as serialized by `Json::htmlEncode()`.
     */
    private const DEFAULT_OPTIONS = <<<JSON
        {"widgetContainer":"dynamic_form","widgetBody":".items","widgetItem":".item","limit":999,"insertButton":".add","deleteButton":".remove","insertPosition":"bottom","formId":"test-form","min":1,"fields":[{"id":"formmodel-{}-name","name":"FormModel[{}][name]"}],"template":"\u003Cdiv class=\u0022item\u0022\u003ERow\u003C\/div\u003E"}
        JSON;

    public function defaultsMatchTheDocumentedConfiguration(): void
    {
        $widget = new DynamicFormWidget(WidgetRenderer::config());

        ob_end_clean();

        Assert::same(
            [$widget->insertPosition, $widget->limit, $widget->min, DynamicFormWidget::WIDGET_NAME],
            ['bottom', 999, 1, 'dynamicform'],
            'Defaults: bottom insertion, limit 999, minimum 1, registry key `dynamicform`.',
        );
    }

    public function discardsRegistrationsOfEndedPagesWhenTheViewIsReused(): void
    {
        // A long-lived process reuses one view for many pages, each with its own form ids.
        foreach (['page-1', 'page-2', 'page-3'] as $formId) {
            WidgetRenderer::render(['formId' => $formId]);

            self::webView()->clear();
        }

        WidgetRenderer::render(['formId' => 'current']);
        WidgetRenderer::render(['formId' => 'current', 'widgetContainer' => 'nested_form']);

        $registrations = (new ReflectionProperty(DynamicFormWidget::class, 'registrations'))->getValue();

        Assert::instanceOf(
            $registrations,
            WeakMap::class,
            'Registrations must be kept per view.',
        );
        $page = $registrations[self::webView()] ?? null;

        Assert::array($page);
        Assert::same(
            array_keys($page),
            ['dynamicform/current/dynamic_form', 'dynamicform/current/nested_form'],
            'Only the registrations of the current page may be retained.',
        );
    }

    public function emitsInitEventBeforeValidatingTheConfiguration(): void
    {
        $events = [];

        try {
            WidgetRenderer::render(
                [
                    'formId' => '',
                    'on init' => static function () use (&$events): void {
                        $events[] = 'init';
                    },
                ],
            );
        } catch (InvalidConfigException) {
        }

        Assert::same(
            $events,
            ['init'],
            'Init event must be triggered once.',
        );
    }

    public function encodesFormIdAndSelectorsInTheGeneratedScripts(): void
    {
        $html = WidgetRenderer::render(
            [
                'formId' => "form\"a'b</script>&",
                'insertButton' => 'button[data-role="add"]',
                'deleteButton' => "[data-role='remove'] > b",
            ],
        );

        Assert::same(
            $html,
            <<<HTML
                <div class="dynamic_form" data-dynamicform="dynamicform_81ae8e79"><div class="items"><div class="item">Row</div></div></div>
                HTML,
            'Container must reference the hashed variable.',
        );
        Assert::same(
            self::registeredJs(View::POS_READY),
            [
                <<<'JS'
                    jQuery(document.getElementById("form\u0022a\u0027b\u003C\/script\u003E\u0026")).on("click", "button[data-role=\u0022add\u0022]", function(e) {
                        e.preventDefault();
                        var $container = jQuery(this).closest("div[data-dynamicform]");
                        if ($container.attr("data-dynamicform") === "dynamicform_81ae8e79") {
                            $container.triggerHandler("beforeInsert", [jQuery(this)]);
                            $container.yiiDynamicForm("addItem", dynamicform_81ae8e79, e, jQuery(this));
                        }
                    });

                    JS,
                <<<'JS'
                    jQuery(document.getElementById("form\u0022a\u0027b\u003C\/script\u003E\u0026")).on("click", "[data-role=\u0027remove\u0027] \u003E b", function(e) {
                        e.preventDefault();
                        var $container = jQuery(this).closest("div[data-dynamicform]");
                        if ($container.attr("data-dynamicform") === "dynamicform_81ae8e79") {
                            $container.yiiDynamicForm("deleteItem", dynamicform_81ae8e79, e, jQuery(this));
                        }
                    });

                    JS,
            ],
            'Form id and selectors must be emitted as HTML-safe JavaScript string literals.',
        );
        Assert::same(
            self::registeredJs(View::POS_LOAD),
            [
                <<<'JS'
                    jQuery(document.getElementById("form\u0022a\u0027b\u003C\/script\u003E\u0026")).yiiDynamicForm(dynamicform_81ae8e79);

                    JS,
            ],
            'Initialization must look up the form by its encoded id.',
        );
    }

    public function encodesTemplateMarkupForTheInlineOptionsScript(): void
    {
        $html = WidgetRenderer::render(
            [],
            '<div class="items"><div class="item">&amp; \'quote\' </script><script>unexpected()</script></div></div>',
        );

        $hashVar = self::hashVar($html);

        Assert::same(
            self::optionsJson($hashVar),
            <<<JS
                {"widgetContainer":"dynamic_form","widgetBody":".items","widgetItem":".item","limit":999,"insertButton":".add","deleteButton":".remove","insertPosition":"bottom","formId":"test-form","min":1,"fields":[{"id":"formmodel-{}-name","name":"FormModel[{}][name]"}],"template":"\u003Cdiv class=\u0022item\u0022\u003E\u0026amp; \u0027quote\u0027 \u003Cscript\u003Eunexpected()\u003C\/script\u003E\u003C\/div\u003E"}
                JS,
            'Markup characters must be escaped so the options cannot end the inline script.',
        );
        Assert::same(
            self::decodedOptions($hashVar)['template'],
            '<div class="item">&amp; \'quote\' <script>unexpected()</script></div>',
            'Template must decode to the first item; the parser drops the stray end tag.',
        );
    }

    public function exposesProtectedHashHooks(): void
    {
        $widget = new InspectableDynamicFormWidget(WidgetRenderer::config());

        ob_end_clean();

        $widget->callHashOptions();

        Assert::same(
            $widget->callGetHashVarName(),
            'dynamicform_f0f724cb',
            'Unregistered containers must use their own hashed variable.',
        );

        WidgetRenderer::render(['widgetContainer' => 'nested_form']);
        $widget->callRegisterOptions(self::webView());

        Assert::same(
            $widget->callGetHashVarName(),
            'dynamicform_f0f724cb',
            'Options declared without a registration must not count as a registration.',
        );

        self::webView()->clear();

        WidgetRenderer::render([], '<div class="items"><div class="item">Row 1</div></div>');

        Assert::same(
            $widget->callGetHashVarName(),
            'dynamicform_0b052ad0',
            'A container registered in the same form of the page must use the registered variable.',
        );
    }

    public function protectedOptionHooksAreCallableFromSubclasses(): void
    {
        $widget = new InspectableDynamicFormWidget(WidgetRenderer::config());

        ob_end_clean();

        $level = ob_get_level();
        $widget->formFields = ['code'];

        $widget->callInitOptions();

        Assert::same(
            ob_get_level(),
            $level + 1,
            'Option initialization must open the content buffer.',
        );

        ob_end_clean();

        $widget->callHashOptions();
        $widget->callRegisterOptions(self::webView());

        Assert::same(
            self::registeredJs(View::POS_HEAD),
            [
                <<<JS
                    var dynamicform_c99d6213 = {"widgetContainer":"dynamic_form","widgetBody":".items","widgetItem":".item","limit":999,"insertButton":".add","deleteButton":".remove","insertPosition":"bottom","formId":"test-form","min":1,"fields":[{"id":"formmodel-{}-code","name":"FormModel[{}][code]"}]};
                    JS . "\n",
            ],
            'Re-initialized options must replace the configured fields.',
        );
    }

    public function publicRegisterAssetsRegistersBundleHandlersAndInitialization(): void
    {
        $widget = new InspectableDynamicFormWidget(WidgetRenderer::config());

        ob_end_clean();

        $widget->callHashOptions();
        $widget->registerAssets(self::webView());

        Assert::same(
            self::registeredJsPositions(),
            [View::POS_READY, View::POS_LOAD],
            'Assets must register handlers and initialization only.',
        );
        Assert::array(self::webView()->assetBundles)->hasKeys(DynamicFormAsset::class);
        Assert::same(
            self::registeredJs(View::POS_LOAD),
            ["jQuery(document.getElementById(\"test-form\")).yiiDynamicForm(dynamicform_f0f724cb);\n"],
            'Initialization must use the hashed variable.',
        );
    }

    /**
     * @param Closure(View): void $startPage Ends the current page of the view or replaces the view.
     */
    #[DataProvider(DynamicFormWidgetProvider::class . '::newPages')]
    public function registersAgainInANewPage(Closure $startPage): void
    {
        WidgetRenderer::render();

        $scripts = self::webView()->js;

        $startPage(self::webView());

        // A head script of the application registered first in the new page must not revive the ended registration.
        self::webView()->registerJs("var application = {};\n", View::POS_HEAD);

        Assert::same(
            WidgetRenderer::render(),
            <<<HTML
                <div class="dynamic_form" data-dynamicform="dynamicform_a2c36ba3"><div class="items"><div class="item">Row</div></div></div>
                HTML,
            'Container must reference its own variable in the new page.',
        );

        foreach ($scripts as $position => $registered) {
            Assert::array($registered);
            Assert::same(
                array_slice(self::registeredJs($position), -count($registered)),
                array_values($registered),
                'New page must declare the options, handlers and initialization again.',
            );
        }

        Assert::same(
            Yii::$app->params,
            [],
            'Registry must not be kept in the application parameters.',
        );
    }

    public function registersAssetBundleWithItsDependencies(): void
    {
        WidgetRenderer::render();

        $bundles = array_keys(self::webView()->assetBundles);

        sort($bundles);

        Assert::same(
            $bundles,
            [DynamicFormAsset::class, JqueryAsset::class, YiiAsset::class, ActiveFormAsset::class],
            'Bundle and its dependency chain must be registered.',
        );
    }

    public function registersEveryConfiguredOption(): void
    {
        $html = WidgetRenderer::render(
            [
                'formFields' => ['name', 'code'],
                'limit' => 4,
                'min' => 2,
                'insertPosition' => 'top',
            ],
        );

        Assert::same(
            self::registeredJs(View::POS_HEAD)[0] ?? null,
            <<<JS
                var dynamicform_e1befe0c = {"widgetContainer":"dynamic_form","widgetBody":".items","widgetItem":".item","limit":4,"insertButton":".add","deleteButton":".remove","insertPosition":"top","formId":"test-form","min":2,"fields":[{"id":"formmodel-{}-name","name":"FormModel[{}][name]"},{"id":"formmodel-{}-code","name":"FormModel[{}][code]"}],"template":"\u003Cdiv class=\u0022item\u0022\u003ERow\u003C\/div\u003E"};

                JS,
            'Every option must be serialized in the declared order.',
        );
        Assert::same(
            $html,
            '<div class="dynamic_form" data-dynamicform="dynamicform_e1befe0c"><div class="items"><div class="item">'
            . 'Row</div></div></div>',
            'Container must reference the hashed variable.',
        );
    }

    public function registersHashVarWidgetOncePerPage(): void
    {
        $widget = new InspectableDynamicFormWidget(WidgetRenderer::config());

        ob_end_clean();

        // `run()` hashes the options, registers the widget and then declares the options in the page.
        $widget->callHashOptions();

        Assert::true(
            $widget->registerHashVarWidget(),
            'First registration must succeed.',
        );

        $widget->callRegisterOptions(self::webView());

        Assert::false(
            $widget->registerHashVarWidget(),
            'Repeated registration in the same page must be refused.',
        );
        Assert::same(
            Yii::$app->params,
            [],
            'Registry must not be kept in the application parameters.',
        );

        self::webView()->clear();

        Assert::true(
            $widget->registerHashVarWidget(),
            'Registration must succeed again once the page is cleared.',
        );
    }

    public function registersOptionsHandlersAndInitializationScripts(): void
    {
        $html = WidgetRenderer::render();

        Assert::same(
            $html,
            <<<HTML
                <div class="dynamic_form" data-dynamicform="dynamicform_a2c36ba3"><div class="items"><div class="item">Row</div></div></div>
                HTML,
            'Container must reference the hashed variable.',
        );
        Assert::same(
            self::registeredJsPositions(),
            [View::POS_HEAD, View::POS_READY, View::POS_LOAD],
            'Scripts must use the head, ready and load positions only.',
        );
        Assert::same(
            self::registeredJs(View::POS_HEAD),
            ['var dynamicform_a2c36ba3 = ' . self::DEFAULT_OPTIONS . ";\n"],
            'Options must be declared once in the head.',
        );
        Assert::same(
            self::registeredJs(View::POS_READY),
            [
                <<<'JS'
                    jQuery(document.getElementById("test-form")).on("click", ".add", function(e) {
                        e.preventDefault();
                        var $container = jQuery(this).closest("div[data-dynamicform]");
                        if ($container.attr("data-dynamicform") === "dynamicform_a2c36ba3") {
                            $container.triggerHandler("beforeInsert", [jQuery(this)]);
                            $container.yiiDynamicForm("addItem", dynamicform_a2c36ba3, e, jQuery(this));
                        }
                    });

                    JS,
                <<<'JS'
                    jQuery(document.getElementById("test-form")).on("click", ".remove", function(e) {
                        e.preventDefault();
                        var $container = jQuery(this).closest("div[data-dynamicform]");
                        if ($container.attr("data-dynamicform") === "dynamicform_a2c36ba3") {
                            $container.yiiDynamicForm("deleteItem", dynamicform_a2c36ba3, e, jQuery(this));
                        }
                    });

                    JS,
            ],
            'Handlers must be delegated from the form and act only on the container that owns the button.',
        );
        Assert::same(
            self::registeredJs(View::POS_LOAD),
            ["jQuery(document.getElementById(\"test-form\")).yiiDynamicForm(dynamicform_a2c36ba3);\n"],
            'Plugin must be initialized on window load.',
        );
    }

    public function registersRepeatedContainerOnlyOnce(): void
    {
        $first = WidgetRenderer::render();

        $scripts = self::webView()->js;

        Assert::same(
            WidgetRenderer::render(),
            $first,
            'Repeated rendering must produce identical markup.',
        );
        Assert::same(
            self::webView()->js,
            $scripts,
            'Repeated rendering must not register scripts again.',
        );
    }

    public function registersSeparateContainersIndependently(): void
    {
        WidgetRenderer::render();

        $html = WidgetRenderer::render(['widgetContainer' => 'nested_form']);

        Assert::same(
            $html,
            <<<HTML
                <div class="nested_form" data-dynamicform="dynamicform_d3cee06d"><div class="items"><div class="item">Row</div></div></div>
                HTML,
            'Second container must reference its own variable.',
        );
        Assert::same(
            [
                count(self::registeredJs(View::POS_HEAD)),
                count(self::registeredJs(View::POS_READY)),
                count(self::registeredJs(View::POS_LOAD)),
            ],
            [2, 4, 2],
            'Each container must register its own options, handlers and initialization.',
        );
        Assert::same(
            WidgetRenderer::render([], '<div class="items"><div class="item">Row 1</div></div>'),
            <<<HTML
                <div class="dynamic_form" data-dynamicform="dynamicform_a2c36ba3"><div class="items"><div class="item">Row 1</div></div></div>
                HTML,
            'Registering another container must keep the first registration.',
        );
        Assert::count(
            self::registeredJs(View::POS_HEAD),
            2,
            'Repeated rendering of the first container must not declare its options again.',
        );
    }

    public function registersTheSameContainerInEachFormIndependently(): void
    {
        $page = self::renderPage(
            static function (): void {
                echo WidgetRenderer::render();
                echo WidgetRenderer::render(
                    [
                        'formId' => 'other-form',
                        'formFields' => ['code'],
                        'limit' => 2,
                    ],
                    '<div class="items"><div class="item">Other</div></div>',
                );
            },
        );

        $options = self::DEFAULT_OPTIONS;
        [$ready, $load] = self::scriptWrapperOpenings();

        Assert::same(
            $page,
            <<<HTML
                <script>var dynamicform_a2c36ba3 = {$options};

                var dynamicform_ce0f18cb = {"widgetContainer":"dynamic_form","widgetBody":".items","widgetItem":".item","limit":2,"insertButton":".add","deleteButton":".remove","insertPosition":"bottom","formId":"other-form","min":1,"fields":[{"id":"formmodel-{}-code","name":"FormModel[{}][code]"}],"template":"\u003Cdiv class=\u0022item\u0022\u003EOther\u003C\/div\u003E"};
                </script><div class="dynamic_form" data-dynamicform="dynamicform_a2c36ba3"><div class="items"><div class="item">Row</div></div></div><div class="dynamic_form" data-dynamicform="dynamicform_ce0f18cb"><div class="items"><div class="item">Other</div></div></div><script>{$ready}
                jQuery(document.getElementById("test-form")).on("click", ".add", function(e) {
                    e.preventDefault();
                    var \$container = jQuery(this).closest("div[data-dynamicform]");
                    if (\$container.attr("data-dynamicform") === "dynamicform_a2c36ba3") {
                        \$container.triggerHandler("beforeInsert", [jQuery(this)]);
                        \$container.yiiDynamicForm("addItem", dynamicform_a2c36ba3, e, jQuery(this));
                    }
                });

                jQuery(document.getElementById("test-form")).on("click", ".remove", function(e) {
                    e.preventDefault();
                    var \$container = jQuery(this).closest("div[data-dynamicform]");
                    if (\$container.attr("data-dynamicform") === "dynamicform_a2c36ba3") {
                        \$container.yiiDynamicForm("deleteItem", dynamicform_a2c36ba3, e, jQuery(this));
                    }
                });

                jQuery(document.getElementById("other-form")).on("click", ".add", function(e) {
                    e.preventDefault();
                    var \$container = jQuery(this).closest("div[data-dynamicform]");
                    if (\$container.attr("data-dynamicform") === "dynamicform_ce0f18cb") {
                        \$container.triggerHandler("beforeInsert", [jQuery(this)]);
                        \$container.yiiDynamicForm("addItem", dynamicform_ce0f18cb, e, jQuery(this));
                    }
                });

                jQuery(document.getElementById("other-form")).on("click", ".remove", function(e) {
                    e.preventDefault();
                    var \$container = jQuery(this).closest("div[data-dynamicform]");
                    if (\$container.attr("data-dynamicform") === "dynamicform_ce0f18cb") {
                        \$container.yiiDynamicForm("deleteItem", dynamicform_ce0f18cb, e, jQuery(this));
                    }
                });

                });</script>
                <script>{$load}
                jQuery(document.getElementById("test-form")).yiiDynamicForm(dynamicform_a2c36ba3);

                jQuery(document.getElementById("other-form")).yiiDynamicForm(dynamicform_ce0f18cb);

                });</script>
                HTML,
            'Each form must declare its own options, handlers and initialization for the shared container name.',
        );
    }

    public function rendersCompletePageWithOptionsBeforeContentAndHandlersAfterIt(): void
    {
        $page = self::renderPage(
            static function (): void {
                echo WidgetRenderer::render();
            },
        );

        $options = self::DEFAULT_OPTIONS;
        [$ready, $load] = self::scriptWrapperOpenings();

        Assert::same(
            $page,
            <<<HTML
                <script>var dynamicform_a2c36ba3 = {$options};
                </script><div class="dynamic_form" data-dynamicform="dynamicform_a2c36ba3"><div class="items"><div class="item">Row</div></div></div><script>{$ready}
                jQuery(document.getElementById("test-form")).on("click", ".add", function(e) {
                    e.preventDefault();
                    var \$container = jQuery(this).closest("div[data-dynamicform]");
                    if (\$container.attr("data-dynamicform") === "dynamicform_a2c36ba3") {
                        \$container.triggerHandler("beforeInsert", [jQuery(this)]);
                        \$container.yiiDynamicForm("addItem", dynamicform_a2c36ba3, e, jQuery(this));
                    }
                });

                jQuery(document.getElementById("test-form")).on("click", ".remove", function(e) {
                    e.preventDefault();
                    var \$container = jQuery(this).closest("div[data-dynamicform]");
                    if (\$container.attr("data-dynamicform") === "dynamicform_a2c36ba3") {
                        \$container.yiiDynamicForm("deleteItem", dynamicform_a2c36ba3, e, jQuery(this));
                    }
                });

                });</script>
                <script>{$load}
                jQuery(document.getElementById("test-form")).yiiDynamicForm(dynamicform_a2c36ba3);

                });</script>
                HTML,
            'Options must precede the content; handlers run on DOM ready and initialization on window load.',
        );
    }

    /**
     * @param array<string, mixed> $overrides
     */
    #[DataProvider(DynamicFormWidgetProvider::class . '::renderedFragments')]
    public function rendersContainerAndTemplate(
        array $overrides,
        string $content,
        string $expectedContent,
        string $expectedTemplate,
    ): void {
        $html = WidgetRenderer::render($overrides, $content);

        $hashVar = self::hashVar($html);

        Assert::same(
            $html,
            sprintf('<div class="dynamic_form" data-dynamicform="%s">%s</div>', $hashVar, $expectedContent),
            'Container must wrap the content and reference the options variable.',
        );
        Assert::same(
            self::decodeNonAsciiEntities(self::decodedOptions($hashVar)['template']),
            $expectedTemplate,
            'Template must be the first item.',
        );
    }

    #[DataProvider(DynamicFormWidgetProvider::class . '::validContainerNames')]
    public function rendersContainerWithValidName(string $name): void
    {
        $html = WidgetRenderer::render(['widgetContainer' => $name]);

        $hashVar = self::hashVar($html);

        Assert::same(
            $html,
            sprintf(
                '<div class="%s" data-dynamicform="%s"><div class="items"><div class="item">Row</div></div></div>',
                $name,
                $hashVar,
            ),
            'Class attribute must hold the name unchanged.',
        );
        Assert::same(
            self::decodedOptions($hashVar)['widgetContainer'] ?? null,
            $name,
            'Option must hold the name unchanged.',
        );
    }

    public function reusesTheCompatibleRegistrationForRepeatedRenderingsInOneForm(): void
    {
        // A nested widget renders once per outer row: the options match, the first row of each rendering differs.
        $page = self::renderPage(
            static function (): void {
                echo WidgetRenderer::render();
                echo WidgetRenderer::render(
                    ['model' => new FormModel(['name' => 'Saved'])],
                    '<div class="items"><div class="item">Row 1</div></div>',
                );
            },
        );

        $options = self::DEFAULT_OPTIONS;
        [$ready, $load] = self::scriptWrapperOpenings();

        Assert::same(
            $page,
            <<<HTML
                <script>var dynamicform_a2c36ba3 = {$options};
                </script><div class="dynamic_form" data-dynamicform="dynamicform_a2c36ba3"><div class="items"><div class="item">Row</div></div></div><div class="dynamic_form" data-dynamicform="dynamicform_a2c36ba3"><div class="items"><div class="item">Row 1</div></div></div><script>{$ready}
                jQuery(document.getElementById("test-form")).on("click", ".add", function(e) {
                    e.preventDefault();
                    var \$container = jQuery(this).closest("div[data-dynamicform]");
                    if (\$container.attr("data-dynamicform") === "dynamicform_a2c36ba3") {
                        \$container.triggerHandler("beforeInsert", [jQuery(this)]);
                        \$container.yiiDynamicForm("addItem", dynamicform_a2c36ba3, e, jQuery(this));
                    }
                });

                jQuery(document.getElementById("test-form")).on("click", ".remove", function(e) {
                    e.preventDefault();
                    var \$container = jQuery(this).closest("div[data-dynamicform]");
                    if (\$container.attr("data-dynamicform") === "dynamicform_a2c36ba3") {
                        \$container.yiiDynamicForm("deleteItem", dynamicform_a2c36ba3, e, jQuery(this));
                    }
                });

                });</script>
                <script>{$load}
                jQuery(document.getElementById("test-form")).yiiDynamicForm(dynamicform_a2c36ba3);

                });</script>
                HTML,
            'Repeated rendering must reference the first registration without declaring options or handlers again.',
        );
    }

    /**
     * @param array<string, mixed> $overrides
     * @param string $content Markup echoed between `begin()` and `end()`.
     */
    #[DataProvider(DynamicFormWidgetProvider::class . '::incompatibleRenderings')]
    public function throwInvalidConfigExceptionForIncompatibleRenderingInTheSameForm(
        array $overrides,
        string $content,
        string $message,
    ): void {
        WidgetRenderer::render();

        $scripts = self::webView()->js;
        $level = ob_get_level();

        try {
            WidgetRenderer::render($overrides, $content);

            Assert::fail(
                'Incompatible rendering must be rejected.',
            );
        } catch (InvalidConfigException $exception) {
            Assert::same(
                $exception->getMessage(),
                $message,
                'Message must name the container, the form and the differing options.',
            );
        }

        Assert::same(
            ob_get_level(),
            $level,
            'Rejected rendering must not leave an output buffer.',
        );
        Assert::same(
            self::webView()->js,
            $scripts,
            'Rejected rendering must not register scripts.',
        );
        Assert::same(
            WidgetRenderer::render([], '<div class="items"><div class="item">Row 1</div></div>'),
            <<<HTML
                <div class="dynamic_form" data-dynamicform="dynamicform_a2c36ba3"><div class="items"><div class="item">Row 1</div></div></div>
                HTML,
            'Registry must keep the first registration after the rejection.',
        );
    }

    /**
     * @param array<string, mixed> $overrides
     * @param string $content Markup echoed between `begin()` and `end()`.
     */
    #[DataProvider(DynamicFormWidgetProvider::class . '::invalidConfigurations')]
    public function throwInvalidConfigExceptionForInvalidConfiguration(
        array $overrides,
        string $message,
        string $content = WidgetRenderer::DEFAULT_CONTENT,
    ): void {
        $level = ob_get_level();

        try {
            WidgetRenderer::render($overrides, $content);

            Assert::fail(
                'Invalid configuration must be rejected.',
            );
        } catch (InvalidConfigException $exception) {
            Assert::same(
                $exception->getMessage(),
                $message,
                'Message must name the invalid property.',
            );
        }

        Assert::same(
            ob_get_level(),
            $level,
            'Rejected configuration must not open an output buffer.',
        );
        try {
            DynamicFormWidget::end();

            Assert::fail(
                'Rejected configuration must not stay on the widget stack.',
            );
        } catch (InvalidCallException $exception) {
            Assert::same(
                $exception->getMessage(),
                'Unexpected ' . DynamicFormWidget::class . '::end() call. A matching begin() is not found.',
                'No widget may be pending after the rejection.',
            );
        }
        Assert::same(
            self::webView()->js,
            [],
            'Rejected configuration must not register scripts.',
        );
    }

    /**
     * @param array<string, mixed> $overrides
     */
    #[DataProvider(DynamicFormWidgetProvider::class . '::configurationsRejectedBeforeInitOptions')]
    public function throwInvalidConfigExceptionForInvalidConfigurationBeforeTheInitOptionsHook(
        array $overrides,
        string $message,
    ): void {
        InspectableDynamicFormWidget::$initOptionsCalls = 0;

        try {
            new InspectableDynamicFormWidget(array_replace(WidgetRenderer::config(), $overrides));

            Assert::fail(
                'Invalid configuration must be rejected.',
            );
        } catch (InvalidConfigException $exception) {
            Assert::same(
                $exception->getMessage(),
                $message,
                'Message must name the invalid property.',
            );
        }

        Assert::same(
            InspectableDynamicFormWidget::$initOptionsCalls,
            0,
            'Overridden hook must receive a validated configuration only.',
        );
    }

    /**
     * @param array<string, mixed> $overrides
     */
    #[DataProvider(DynamicFormWidgetProvider::class . '::weakScalarConfigurations')]
    public function weakScalarConfiguration(
        array $overrides,
        string $expectedContent,
        string $option,
        mixed $expected,
    ): void {
        $html = WidgetRenderer::render($overrides);

        $hashVar = self::hashVar($html);

        Assert::same(
            $html,
            sprintf('<div class="dynamic_form" data-dynamicform="%s">%s</div>', $hashVar, $expectedContent),
            'Container content must follow the strict server-side comparison.',
        );
        Assert::same(
            self::decodedOptions($hashVar)[$option] ?? null,
            $expected,
            'Option must be emitted with its configured type.',
        );
    }

    /**
     * @return array<string, mixed>
     */
    private static function decodedOptions(string $hashVar): array
    {
        $options = Json::decode(self::optionsJson($hashVar));

        Assert::array($options);

        /** @var array<string, mixed> $options */
        return $options;
    }

    /**
     * Decodes HTML entities that stand for non-ASCII characters.
     *
     * libxml 2.9 serializes the template text `Ñandú` as `&Ntilde;and&uacute;`, libxml 2.15 as raw UTF-8; both are the
     * same HTML. Entities of ASCII characters (`&amp;`, `&lt;`, `&quot;`) are kept, so escaping stays observable.
     */
    private static function decodeNonAsciiEntities(mixed $html): string
    {
        Assert::string($html);

        return (string) preg_replace_callback(
            '/&(?:#\d+|#x[0-9a-f]+|[a-z][a-z0-9]*);/i',
            static function (array $entity): string {
                $character = html_entity_decode($entity[0], ENT_QUOTES | ENT_HTML5, 'UTF-8');

                return mb_strlen($character, 'UTF-8') === 1 && ord($character[0]) >= 0x80 ? $character : $entity[0];
            },
            $html,
        );
    }

    private static function hashVar(string $html): string
    {
        if (preg_match('/^<div class="[^"]*" data-dynamicform="(dynamicform_[0-9a-f]{8})">/', $html, $match) !== 1) {
            Assert::fail('Container must reference a hashed options variable.');
        }

        return $match[1];
    }

    private static function optionsJson(string $hashVar): string
    {
        $head = self::registeredJs(View::POS_HEAD);

        Assert::count(
            $head,
            1,
            'Options must be declared once.',
        );
        if (preg_match('/^var ' . $hashVar . ' = (.*);\n$/s', $head[0], $match) !== 1) {
            Assert::fail('Head script must declare the referenced variable.');
        }

        return $match[1];
    }
}
