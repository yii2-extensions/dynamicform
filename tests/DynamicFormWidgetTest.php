<?php

declare(strict_types=1);

namespace Yii2\Extensions\DynamicForm\Tests;

use Closure;
use PHPUnit\Framework\Attributes\{DataProviderExternal, Group};
use ReflectionProperty;
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
    TestCase,
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
#[Group('widget')]
final class DynamicFormWidgetTest extends TestCase
{
    /**
     * Options of {@see WidgetRenderer::config()} as serialized by `Json::htmlEncode()`.
     */
    private const DEFAULT_OPTIONS = <<<JSON
        {"widgetContainer":"dynamic_form","widgetBody":".items","widgetItem":".item","limit":999,"insertButton":".add","deleteButton":".remove","insertPosition":"bottom","formId":"test-form","min":1,"fields":[{"id":"formmodel-{}-name","name":"FormModel[{}][name]"}],"template":"\u003Cdiv class=\u0022item\u0022\u003ERow\u003C\/div\u003E"}
        JSON;

    public function testDefaultsMatchTheDocumentedConfiguration(): void
    {
        $widget = new DynamicFormWidget(WidgetRenderer::config());

        ob_end_clean();

        self::assertSame(
            ['bottom', 999, 1, 'dynamicform'],
            [$widget->insertPosition, $widget->limit, $widget->min, DynamicFormWidget::WIDGET_NAME],
            'Defaults: bottom insertion, limit 999, minimum 1, registry key `dynamicform`.',
        );
    }

    public function testDiscardsRegistrationsOfEndedPagesWhenTheViewIsReused(): void
    {
        // A long-lived process reuses one view for many pages, each with its own form ids.
        foreach (['page-1', 'page-2', 'page-3'] as $formId) {
            WidgetRenderer::render(['formId' => $formId]);

            self::webView()->clear();
        }

        WidgetRenderer::render(['formId' => 'current']);
        WidgetRenderer::render(['formId' => 'current', 'widgetContainer' => 'nested_form']);

        $registrations = (new ReflectionProperty(DynamicFormWidget::class, 'registrations'))->getValue();

        self::assertInstanceOf(
            WeakMap::class,
            $registrations,
            'Registrations must be kept per view.',
        );
        $page = $registrations[self::webView()] ?? null;

        self::assertIsArray(
            $page,
            'The reused view must hold the registrations of its current page.',
        );
        self::assertSame(
            ['dynamicform/current/dynamic_form', 'dynamicform/current/nested_form'],
            array_keys($page),
            'Only the registrations of the current page may be retained.',
        );
    }

    public function testEmitsInitEventBeforeValidatingTheConfiguration(): void
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

        self::assertSame(
            ['init'],
            $events,
            'Init event must be triggered once.',
        );
    }

    public function testEncodesFormIdAndSelectorsInTheGeneratedScripts(): void
    {
        $html = WidgetRenderer::render(
            [
                'formId' => "form\"a'b</script>&",
                'insertButton' => 'button[data-role="add"]',
                'deleteButton' => "[data-role='remove'] > b",
            ],
        );

        self::assertSame(
            <<<HTML
                <div class="dynamic_form" data-dynamicform="dynamicform_81ae8e79"><div class="items"><div class="item">Row</div></div></div>
                HTML,
            $html,
            'Container must reference the hashed variable.',
        );
        self::assertSame(
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
            self::registeredJs(View::POS_READY),
            'Form id and selectors must be emitted as HTML-safe JavaScript string literals.',
        );
        self::assertSame(
            [
                <<<'JS'
                    jQuery(document.getElementById("form\u0022a\u0027b\u003C\/script\u003E\u0026")).yiiDynamicForm(dynamicform_81ae8e79);

                    JS,
            ],
            self::registeredJs(View::POS_LOAD),
            'Initialization must look up the form by its encoded id.',
        );
    }

    public function testEncodesTemplateMarkupForTheInlineOptionsScript(): void
    {
        $html = WidgetRenderer::render(
            [],
            '<div class="items"><div class="item">&amp; \'quote\' </script><script>unexpected()</script></div></div>',
        );

        $hashVar = self::hashVar($html);

        self::assertSame(
            <<<JS
                {"widgetContainer":"dynamic_form","widgetBody":".items","widgetItem":".item","limit":999,"insertButton":".add","deleteButton":".remove","insertPosition":"bottom","formId":"test-form","min":1,"fields":[{"id":"formmodel-{}-name","name":"FormModel[{}][name]"}],"template":"\u003Cdiv class=\u0022item\u0022\u003E\u0026amp; \u0027quote\u0027 \u003Cscript\u003Eunexpected()\u003C\/script\u003E\u003C\/div\u003E"}
                JS,
            self::optionsJson($hashVar),
            'Markup characters must be escaped so the options cannot end the inline script.',
        );
        self::assertSame(
            '<div class="item">&amp; \'quote\' <script>unexpected()</script></div>',
            self::decodedOptions($hashVar)['template'],
            'Template must decode to the first item; the parser drops the stray end tag.',
        );
    }

    public function testExposesProtectedHashHooks(): void
    {
        $widget = new InspectableDynamicFormWidget(WidgetRenderer::config());

        ob_end_clean();

        $widget->callHashOptions();

        self::assertSame(
            'dynamicform_f0f724cb',
            $widget->callGetHashVarName(),
            'Unregistered containers must use their own hashed variable.',
        );

        WidgetRenderer::render(['widgetContainer' => 'nested_form']);
        $widget->callRegisterOptions(self::webView());

        self::assertSame(
            'dynamicform_f0f724cb',
            $widget->callGetHashVarName(),
            'Options declared without a registration must not count as a registration.',
        );

        self::webView()->clear();

        WidgetRenderer::render([], '<div class="items"><div class="item">Row 1</div></div>');

        self::assertSame(
            'dynamicform_0b052ad0',
            $widget->callGetHashVarName(),
            'A container registered in the same form of the page must use the registered variable.',
        );
    }

    public function testProtectedOptionHooksAreCallableFromSubclasses(): void
    {
        $widget = new InspectableDynamicFormWidget(WidgetRenderer::config());

        ob_end_clean();

        $level = ob_get_level();
        $widget->formFields = ['code'];

        $widget->callInitOptions();

        self::assertSame(
            $level + 1,
            ob_get_level(),
            'Option initialization must open the content buffer.',
        );

        ob_end_clean();

        $widget->callHashOptions();
        $widget->callRegisterOptions(self::webView());

        self::assertSame(
            [
                <<<JS
                    var dynamicform_c99d6213 = {"widgetContainer":"dynamic_form","widgetBody":".items","widgetItem":".item","limit":999,"insertButton":".add","deleteButton":".remove","insertPosition":"bottom","formId":"test-form","min":1,"fields":[{"id":"formmodel-{}-code","name":"FormModel[{}][code]"}]};
                    JS . "\n",
            ],
            self::registeredJs(View::POS_HEAD),
            'Re-initialized options must replace the configured fields.',
        );
    }

    public function testPublicRegisterAssetsRegistersBundleHandlersAndInitialization(): void
    {
        $widget = new InspectableDynamicFormWidget(WidgetRenderer::config());

        ob_end_clean();

        $widget->callHashOptions();
        $widget->registerAssets(self::webView());

        self::assertSame(
            [View::POS_READY, View::POS_LOAD],
            self::registeredJsPositions(),
            'Assets must register handlers and initialization only.',
        );
        self::assertArrayHasKey(
            DynamicFormAsset::class,
            self::webView()->assetBundles,
            'Bundle must be registered.',
        );
        self::assertSame(
            ["jQuery(document.getElementById(\"test-form\")).yiiDynamicForm(dynamicform_f0f724cb);\n"],
            self::registeredJs(View::POS_LOAD),
            'Initialization must use the hashed variable.',
        );
    }

    /**
     * @param Closure(View): void $startPage Ends the current page of the view or replaces the view.
     */
    #[DataProviderExternal(DynamicFormWidgetProvider::class, 'newPages')]
    public function testRegistersAgainInANewPage(Closure $startPage): void
    {
        WidgetRenderer::render();

        $scripts = self::webView()->js;

        $startPage(self::webView());

        // A head script of the application registered first in the new page must not revive the ended registration.
        self::webView()->registerJs("var application = {};\n", View::POS_HEAD);

        self::assertSame(
            <<<HTML
                <div class="dynamic_form" data-dynamicform="dynamicform_a2c36ba3"><div class="items"><div class="item">Row</div></div></div>
                HTML,
            WidgetRenderer::render(),
            'Container must reference its own variable in the new page.',
        );

        foreach ($scripts as $position => $registered) {
            self::assertIsArray(
                $registered,
                'Registered scripts must be grouped by position.',
            );
            self::assertSame(
                array_values($registered),
                array_slice(self::registeredJs($position), -count($registered)),
                'New page must declare the options, handlers and initialization again.',
            );
        }

        self::assertSame(
            [],
            Yii::$app->params,
            'Registry must not be kept in the application parameters.',
        );
    }

    public function testRegistersAssetBundleWithItsDependencies(): void
    {
        WidgetRenderer::render();

        $bundles = array_keys(self::webView()->assetBundles);

        sort($bundles);

        self::assertSame(
            [DynamicFormAsset::class, JqueryAsset::class, YiiAsset::class, ActiveFormAsset::class],
            $bundles,
            'Bundle and its dependency chain must be registered.',
        );
    }

    public function testRegistersEveryConfiguredOption(): void
    {
        $html = WidgetRenderer::render(
            [
                'formFields' => ['name', 'code'],
                'limit' => 4,
                'min' => 2,
                'insertPosition' => 'top',
            ],
        );

        self::assertSame(
            <<<JS
                var dynamicform_e1befe0c = {"widgetContainer":"dynamic_form","widgetBody":".items","widgetItem":".item","limit":4,"insertButton":".add","deleteButton":".remove","insertPosition":"top","formId":"test-form","min":2,"fields":[{"id":"formmodel-{}-name","name":"FormModel[{}][name]"},{"id":"formmodel-{}-code","name":"FormModel[{}][code]"}],"template":"\u003Cdiv class=\u0022item\u0022\u003ERow\u003C\/div\u003E"};

                JS,
            self::registeredJs(View::POS_HEAD)[0] ?? null,
            'Every option must be serialized in the declared order.',
        );
        self::assertSame(
            '<div class="dynamic_form" data-dynamicform="dynamicform_e1befe0c"><div class="items"><div class="item">'
            . 'Row</div></div></div>',
            $html,
            'Container must reference the hashed variable.',
        );
    }

    public function testRegistersHashVarWidgetOncePerPage(): void
    {
        $widget = new InspectableDynamicFormWidget(WidgetRenderer::config());

        ob_end_clean();

        // `run()` hashes the options, registers the widget and then declares the options in the page.
        $widget->callHashOptions();

        self::assertTrue(
            $widget->registerHashVarWidget(),
            'First registration must succeed.',
        );

        $widget->callRegisterOptions(self::webView());

        self::assertFalse(
            $widget->registerHashVarWidget(),
            'Repeated registration in the same page must be refused.',
        );
        self::assertSame(
            [],
            Yii::$app->params,
            'Registry must not be kept in the application parameters.',
        );

        self::webView()->clear();

        self::assertTrue(
            $widget->registerHashVarWidget(),
            'Registration must succeed again once the page is cleared.',
        );
    }

    public function testRegistersOptionsHandlersAndInitializationScripts(): void
    {
        $html = WidgetRenderer::render();

        self::assertSame(
            <<<HTML
                <div class="dynamic_form" data-dynamicform="dynamicform_a2c36ba3"><div class="items"><div class="item">Row</div></div></div>
                HTML,
            $html,
            'Container must reference the hashed variable.',
        );
        self::assertSame(
            [View::POS_HEAD, View::POS_READY, View::POS_LOAD],
            self::registeredJsPositions(),
            'Scripts must use the head, ready and load positions only.',
        );
        self::assertSame(
            ['var dynamicform_a2c36ba3 = ' . self::DEFAULT_OPTIONS . ";\n"],
            self::registeredJs(View::POS_HEAD),
            'Options must be declared once in the head.',
        );
        self::assertSame(
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
            self::registeredJs(View::POS_READY),
            'Handlers must be delegated from the form and act only on the container that owns the button.',
        );
        self::assertSame(
            ["jQuery(document.getElementById(\"test-form\")).yiiDynamicForm(dynamicform_a2c36ba3);\n"],
            self::registeredJs(View::POS_LOAD),
            'Plugin must be initialized on window load.',
        );
    }

    public function testRegistersRepeatedContainerOnlyOnce(): void
    {
        $first = WidgetRenderer::render();

        $scripts = self::webView()->js;

        self::assertSame(
            $first,
            WidgetRenderer::render(),
            'Repeated rendering must produce identical markup.',
        );
        self::assertSame(
            $scripts,
            self::webView()->js,
            'Repeated rendering must not register scripts again.',
        );
    }

    public function testRegistersSeparateContainersIndependently(): void
    {
        WidgetRenderer::render();

        $html = WidgetRenderer::render(['widgetContainer' => 'nested_form']);

        self::assertSame(
            <<<HTML
                <div class="nested_form" data-dynamicform="dynamicform_d3cee06d"><div class="items"><div class="item">Row</div></div></div>
                HTML,
            $html,
            'Second container must reference its own variable.',
        );
        self::assertSame(
            [2, 4, 2],
            [
                count(self::registeredJs(View::POS_HEAD)),
                count(self::registeredJs(View::POS_READY)),
                count(self::registeredJs(View::POS_LOAD)),
            ],
            'Each container must register its own options, handlers and initialization.',
        );
        self::assertSame(
            <<<HTML
                <div class="dynamic_form" data-dynamicform="dynamicform_a2c36ba3"><div class="items"><div class="item">Row 1</div></div></div>
                HTML,
            WidgetRenderer::render([], '<div class="items"><div class="item">Row 1</div></div>'),
            'Registering another container must keep the first registration.',
        );
        self::assertCount(
            2,
            self::registeredJs(View::POS_HEAD),
            'Repeated rendering of the first container must not declare its options again.',
        );
    }

    public function testRegistersTheSameContainerInEachFormIndependently(): void
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

        self::assertSame(
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
            $page,
            'Each form must declare its own options, handlers and initialization for the shared container name.',
        );
    }

    public function testRendersCompletePageWithOptionsBeforeContentAndHandlersAfterIt(): void
    {
        $page = self::renderPage(
            static function (): void {
                echo WidgetRenderer::render();
            },
        );

        $options = self::DEFAULT_OPTIONS;
        [$ready, $load] = self::scriptWrapperOpenings();

        self::assertSame(
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
            $page,
            'Options must precede the content; handlers run on DOM ready and initialization on window load.',
        );
    }

    /**
     * @param array<string, mixed> $overrides
     */
    #[DataProviderExternal(DynamicFormWidgetProvider::class, 'renderedFragments')]
    public function testRendersContainerAndTemplate(
        array $overrides,
        string $content,
        string $expectedContent,
        string $expectedTemplate,
    ): void {
        $html = WidgetRenderer::render($overrides, $content);

        $hashVar = self::hashVar($html);

        self::assertSame(
            sprintf('<div class="dynamic_form" data-dynamicform="%s">%s</div>', $hashVar, $expectedContent),
            $html,
            'Container must wrap the content and reference the options variable.',
        );
        self::assertSame(
            $expectedTemplate,
            self::decodeNonAsciiEntities(self::decodedOptions($hashVar)['template']),
            'Template must be the first item.',
        );
    }

    #[DataProviderExternal(DynamicFormWidgetProvider::class, 'validContainerNames')]
    public function testRendersContainerWithValidName(string $name): void
    {
        $html = WidgetRenderer::render(['widgetContainer' => $name]);

        $hashVar = self::hashVar($html);

        self::assertSame(
            sprintf(
                '<div class="%s" data-dynamicform="%s"><div class="items"><div class="item">Row</div></div></div>',
                $name,
                $hashVar,
            ),
            $html,
            'Class attribute must hold the name unchanged.',
        );
        self::assertSame(
            $name,
            self::decodedOptions($hashVar)['widgetContainer'] ?? null,
            'Option must hold the name unchanged.',
        );
    }

    public function testReusesTheCompatibleRegistrationForRepeatedRenderingsInOneForm(): void
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

        self::assertSame(
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
            $page,
            'Repeated rendering must reference the first registration without declaring options or handlers again.',
        );
    }

    /**
     * @param array<string, mixed> $overrides
     * @param string $content Markup echoed between `begin()` and `end()`.
     */
    #[DataProviderExternal(DynamicFormWidgetProvider::class, 'incompatibleRenderings')]
    public function testThrowInvalidConfigExceptionForIncompatibleRenderingInTheSameForm(
        array $overrides,
        string $content,
        string $message,
    ): void {
        WidgetRenderer::render();

        $scripts = self::webView()->js;
        $level = ob_get_level();

        try {
            WidgetRenderer::render($overrides, $content);

            self::fail(
                'Incompatible rendering must be rejected.',
            );
        } catch (InvalidConfigException $exception) {
            self::assertSame(
                $message,
                $exception->getMessage(),
                'Message must name the container, the form and the differing options.',
            );
        }

        self::assertSame(
            $level,
            ob_get_level(),
            'Rejected rendering must not leave an output buffer.',
        );
        self::assertSame(
            $scripts,
            self::webView()->js,
            'Rejected rendering must not register scripts.',
        );
        self::assertSame(
            <<<HTML
                <div class="dynamic_form" data-dynamicform="dynamicform_a2c36ba3"><div class="items"><div class="item">Row 1</div></div></div>
                HTML,
            WidgetRenderer::render([], '<div class="items"><div class="item">Row 1</div></div>'),
            'Registry must keep the first registration after the rejection.',
        );
    }

    /**
     * @param array<string, mixed> $overrides
     * @param string $content Markup echoed between `begin()` and `end()`.
     */
    #[DataProviderExternal(DynamicFormWidgetProvider::class, 'invalidConfigurations')]
    public function testThrowInvalidConfigExceptionForInvalidConfiguration(
        array $overrides,
        string $message,
        string $content = WidgetRenderer::DEFAULT_CONTENT,
    ): void {
        $level = ob_get_level();

        try {
            WidgetRenderer::render($overrides, $content);

            self::fail(
                'Invalid configuration must be rejected.',
            );
        } catch (InvalidConfigException $exception) {
            self::assertSame(
                $message,
                $exception->getMessage(),
                'Message must name the invalid property.',
            );
        }

        self::assertSame(
            $level,
            ob_get_level(),
            'Rejected configuration must not open an output buffer.',
        );
        try {
            DynamicFormWidget::end();

            self::fail(
                'Rejected configuration must not stay on the widget stack.',
            );
        } catch (InvalidCallException $exception) {
            self::assertSame(
                'Unexpected ' . DynamicFormWidget::class . '::end() call. A matching begin() is not found.',
                $exception->getMessage(),
                'No widget may be pending after the rejection.',
            );
        }
        self::assertSame(
            [],
            self::webView()->js,
            'Rejected configuration must not register scripts.',
        );
    }

    /**
     * @param array<string, mixed> $overrides
     */
    #[DataProviderExternal(DynamicFormWidgetProvider::class, 'configurationsRejectedBeforeInitOptions')]
    public function testThrowInvalidConfigExceptionForInvalidConfigurationBeforeTheInitOptionsHook(
        array $overrides,
        string $message,
    ): void {
        InspectableDynamicFormWidget::$initOptionsCalls = 0;

        try {
            new InspectableDynamicFormWidget(array_replace(WidgetRenderer::config(), $overrides));

            self::fail(
                'Invalid configuration must be rejected.',
            );
        } catch (InvalidConfigException $exception) {
            self::assertSame(
                $message,
                $exception->getMessage(),
                'Message must name the invalid property.',
            );
        }

        self::assertSame(
            0,
            InspectableDynamicFormWidget::$initOptionsCalls,
            'Overridden hook must receive a validated configuration only.',
        );
    }

    /**
     * @param array<string, mixed> $overrides
     */
    #[DataProviderExternal(DynamicFormWidgetProvider::class, 'weakScalarConfigurations')]
    public function testWeakScalarConfiguration(
        array $overrides,
        string $expectedContent,
        string $option,
        mixed $expected,
    ): void {
        $html = WidgetRenderer::render($overrides);

        $hashVar = self::hashVar($html);

        self::assertSame(
            sprintf('<div class="dynamic_form" data-dynamicform="%s">%s</div>', $hashVar, $expectedContent),
            $html,
            'Container content must follow the strict server-side comparison.',
        );
        self::assertSame(
            $expected,
            self::decodedOptions($hashVar)[$option] ?? null,
            'Option must be emitted with its configured type.',
        );
    }

    /**
     * @return array<string, mixed>
     */
    private static function decodedOptions(string $hashVar): array
    {
        $options = Json::decode(self::optionsJson($hashVar));

        self::assertIsArray(
            $options,
            'Options must decode to an object.',
        );

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
        self::assertIsString(
            $html,
            'Template must be a string.',
        );

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
        self::assertSame(
            1,
            preg_match('/^<div class="[^"]*" data-dynamicform="(dynamicform_[0-9a-f]{8})">/', $html, $match),
            'Container must reference a hashed options variable.',
        );

        return $match[1];
    }

    private static function optionsJson(string $hashVar): string
    {
        $head = self::registeredJs(View::POS_HEAD);

        self::assertCount(
            1,
            $head,
            'Options must be declared once.',
        );
        self::assertSame(
            1,
            preg_match('/^var ' . $hashVar . ' = (.*);\n$/s', $head[0], $match),
            'Head script must declare the referenced variable.',
        );

        return $match[1];
    }
}
