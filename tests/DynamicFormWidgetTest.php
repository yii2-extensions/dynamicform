<?php

declare(strict_types=1);

namespace Yii2\Extensions\DynamicForm\Tests;

use PHPUnit\Framework\Attributes\{DataProviderExternal, Group};
use PHPUnit\Framework\ExpectationFailedException;
use Yii;
use yii\base\InvalidConfigException;
use yii\base\Widget;
use yii\helpers\Json;
use yii\web\{JqueryAsset, View, YiiAsset};
use yii\widgets\ActiveFormAsset;
use Yii2\Extensions\DynamicForm\{DynamicFormAsset, DynamicFormWidget};
use Yii2\Extensions\DynamicForm\Tests\Provider\DynamicFormWidgetProvider;
use Yii2\Extensions\DynamicForm\Tests\Support\{
    InspectableDynamicFormWidget,
    KnownDefect,
    TestCase,
    WidgetRenderer,
};

use function array_keys;
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

        Yii::$app->params = [DynamicFormWidget::WIDGET_NAME => ['dynamic_form' => 'dynamicform_registered']];

        self::assertSame(
            'dynamicform_registered',
            $widget->callGetHashVarName(),
            'Registered containers must use the registered variable.',
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
            ["jQuery(\"#test-form\").yiiDynamicForm(dynamicform_f0f724cb);\n"],
            self::registeredJs(View::POS_LOAD),
            'Initialization must use the hashed variable.',
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

    public function testRegistersHashVarWidgetOncePerContainer(): void
    {
        $widget = new InspectableDynamicFormWidget(WidgetRenderer::config());

        ob_end_clean();

        // `run()` hashes the options before registering; the registry stores that variable name.
        $widget->callHashOptions();

        self::assertTrue(
            $widget->registerHashVarWidget(),
            'First registration must succeed.',
        );
        self::assertFalse(
            $widget->registerHashVarWidget(),
            'Repeated registration must be refused.',
        );
        self::assertSame(
            [DynamicFormWidget::WIDGET_NAME => ['dynamic_form' => 'dynamicform_f0f724cb']],
            Yii::$app->params,
            'Registry must map the container name to its variable.',
        );
    }

    public function testRegistersOptionsHandlersAndInitializationScripts(): void
    {
        $html = WidgetRenderer::render();

        // The beforeInsert line targets every container with the class; owner targeting is pending (F-11, Phase 3C).
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
                    jQuery("#test-form").on("click", ".add", function(e) {
                        e.preventDefault();
                        jQuery(".dynamic_form").triggerHandler("beforeInsert", [jQuery(this)]);
                        jQuery(".dynamic_form").yiiDynamicForm("addItem", dynamicform_a2c36ba3, e, jQuery(this));
                    });

                    JS,
                <<<'JS'
                    jQuery("#test-form").on("click", ".remove", function(e) {
                        e.preventDefault();
                        jQuery(".dynamic_form").yiiDynamicForm("deleteItem", dynamicform_a2c36ba3, e, jQuery(this));
                    });

                    JS,
            ],
            self::registeredJs(View::POS_READY),
            'Insert and delete handlers must be delegated from the form.',
        );
        self::assertSame(
            ["jQuery(\"#test-form\").yiiDynamicForm(dynamicform_a2c36ba3);\n"],
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
    }

    public function testRendersCompletePageWithOptionsBeforeContentAndHandlersAfterIt(): void
    {
        $page = self::renderPage(
            static function (): void {
                echo WidgetRenderer::render();
            },
        );

        $options = self::DEFAULT_OPTIONS;

        self::assertSame(
            <<<HTML
                <script>var dynamicform_a2c36ba3 = {$options};
                </script><div class="dynamic_form" data-dynamicform="dynamicform_a2c36ba3"><div class="items"><div class="item">Row</div></div></div><script>jQuery(function (\$) {
                jQuery("#test-form").on("click", ".add", function(e) {
                    e.preventDefault();
                    jQuery(".dynamic_form").triggerHandler("beforeInsert", [jQuery(this)]);
                    jQuery(".dynamic_form").yiiDynamicForm("addItem", dynamicform_a2c36ba3, e, jQuery(this));
                });

                jQuery("#test-form").on("click", ".remove", function(e) {
                    e.preventDefault();
                    jQuery(".dynamic_form").yiiDynamicForm("deleteItem", dynamicform_a2c36ba3, e, jQuery(this));
                });

                });</script>
                <script>jQuery(window).on('load', function () {
                jQuery("#test-form").yiiDynamicForm(dynamicform_a2c36ba3);

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

    public function testReusesTheFirstRegistrationForTheSameContainerInAnotherForm(): void
    {
        // Characterization of the accepted collision (F-08); the registry scope is pending decision D02.
        WidgetRenderer::render();

        $html = WidgetRenderer::render(
            [
                'formId' => 'other-form',
                'formFields' => ['code'],
            ],
        );

        self::assertSame(
            <<<HTML
                <div class="dynamic_form" data-dynamicform="dynamicform_a2c36ba3"><div class="items"><div class="item">Row</div></div></div>
                HTML,
            $html,
            'Second form must reference the first registration.',
        );
        self::assertSame(
            ['var dynamicform_a2c36ba3 = ' . self::DEFAULT_OPTIONS . ";\n"],
            self::registeredJs(View::POS_HEAD),
            'Second form must not register its own options.',
        );
    }

    #[Group('known-defect')]
    public function testThrowInvalidConfigExceptionForContainerNameWithTrailingNewline(): void
    {
        // `$` without the `D` modifier also matches before a final line feed, so the documented character set is not
        // enforced and the class attribute receives the line feed.
        KnownDefect::assertViolates(
            'N-02',
            ExpectationFailedException::class,
            'A container name with a line feed must be rejected.',
            static function (): void {
                $rejected = false;

                try {
                    WidgetRenderer::render(['widgetContainer' => "dynamic_form\n"]);
                } catch (InvalidConfigException) {
                    $rejected = true;
                }

                self::assertTrue(
                    $rejected,
                    'A container name with a line feed must be rejected.',
                );
            },
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
        self::assertSame(
            [],
            Widget::$stack,
            'Rejected configuration must not stay on the widget stack.',
        );
        self::assertSame(
            [],
            self::webView()->js,
            'Rejected configuration must not register scripts.',
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
