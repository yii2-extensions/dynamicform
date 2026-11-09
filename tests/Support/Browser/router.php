<?php

declare(strict_types=1);

/**
 * Entry script of the PHP-rendered browser acceptance fixture, run by the PHP built-in server from the repository root:
 *
 *     php -S 127.0.0.1:8090 tests/Support/Browser/router.php
 *
 * `/source/...` runs with `YII_DEBUG=true` and `/production/...` with `YII_DEBUG=false`. Each request is a fresh process
 * context, so DynamicFormAsset selects its file exactly as in an application; no asset override is applied. Below the
 * variant, `health` answers a plain text probe, `form/<scenario>` renders a scenario and `submit/<scenario>` echoes the
 * posted payload as JSON. `depdrop/<list>` (DepDrop requests) and `lookup/owners` (Select2 AJAX searches) answer the
 * Kartik scenario with deterministic JSON. Assets are published below `runtime/browser-fixture`, which the built-in
 * server serves itself.
 */

use yii\helpers\FileHelper;
use yii\web\{Application, Response};
use Yii2\Extensions\DynamicForm\Tests\Support\Browser\{KartikCatalog, StderrTarget};

$root = dirname(__DIR__, 3);
$uri = $_SERVER['REQUEST_URI'] ?? '/';
$path = parse_url(is_string($uri) ? $uri : '/', PHP_URL_PATH);
$path = is_string($path) ? $path : '/';

if (str_starts_with($path, '/runtime/browser-fixture/') && is_file($root . $path)) {
    return false;
}

if (preg_match('#^/(source|production)/(health|form|submit|depdrop|lookup)(?:/([\w-]+))?$#', $path, $match) !== 1) {
    http_response_code(404);
    echo 'Unknown fixture path.';

    return true;
}

[, $variant, $route] = $match;
$name = $match[3] ?? '';

/**
 * Rendered scenarios as differences from the defaults applied below. Validation-enabled and validation-disabled
 * scenarios are separate, so missing ActiveForm data is never the reason a scenario that targets another behavior fails.
 */
$scenarios = [
    // Existing row, client validation enabled.
    'validation' => [],
    // Same markup with client validation disabled.
    'no-validation' => ['clientValidation' => false],
    // min=0 with a new model: the server removes the rendered row, the template remains in the options.
    'zero-start' => ['min' => 0, 'persisted' => false],
    // min=0 with an existing row, so the last row can be deleted and inserted again.
    'last-row' => ['min' => 0],
    // Window load is gated by an image whose response the browser test holds, to click before the POS_LOAD init.
    'preload' => ['loadGate' => true],
    // Insert and delete selectors containing double and single quotes, emitted by PHP into the click handlers.
    'quoted-selector' => ['insertButton' => 'button[data-role="add"]', 'deleteButton' => "button[data-role='remove']"],
    // A form id with quotes, CSS syntax and an end tag. Yii's ActiveForm script selects the form with `#id`, which such
    // an id breaks, so the form renders without its client script.
    'special-form-id' => ['formId' => "dynamic-form.\"v1'</script>:[x]", 'clientScript' => false],
    // Houses containing rooms: one outer and one inner widget, both rendered through begin()/end().
    'nested' => ['view' => 'nested'],
    // Two houses rendered by the server: the inner widget is rendered once per house with compatible options.
    'nested-repeated' => ['view' => 'nested', 'houses' => [['h0', ['r00']], ['h1', ['r10', 'r11']]]],
    // Outer and inner widgets configured with the same insert and delete selectors.
    'nested-shared-buttons' => ['view' => 'nested', 'sharedButtons' => true],
    // Two forms on one page, each with its own widget and model.
    'two-forms' => ['view' => 'two-forms'],
    // Two forms whose widgets use the same container name with different options.
    'two-forms-same-container' => ['view' => 'two-forms', 'sameContainer' => true],
    // A foreign element sharing the container class sits before the widget inside the form; a POS_LOAD flag is set
    // after the widget initialization to verify that the error does not block subsequent scripts.
    'foreign-container' => ['foreignContainer' => true],
    // Numeric literal keys around the row index: a row form name holding `[2024]` and a `[7]code` field.
    'numeric-literal-key' => ['rowFormName' => 'FormModel[2024]', 'codeKey' => '[7]'],
    // Stored rows with every kind of control a form reset restores, next to a sibling form with its own widget.
    'reset' => ['view' => 'reset'],
    // Real Kartik Select2 and DepDrop widgets: `[Production]`/`[Sales]` literal keys in one form, `Row[2024]` in another.
    'kartik' => ['view' => 'kartik'],
    // Real TomSelect 2.4.3 next to Kartik Select2 and plain selects: card rows, table rows under `Row[2024]` with a
    // `[Sales]` literal key, and nested rows.
    'tomselect' => ['view' => 'tomselect'],
    // Yii MaskedInput (Inputmask 5.0.10) in stored rows, in a form that starts with zero rows, and in nested rows.
    'inputmask' => ['view' => 'inputmask'],
    // Kartik DatePicker 1.4.8 (prepended component and `TYPE_INPUT`) in stored rows, in a form that starts with zero rows,
    // and in nested rows.
    'datepicker' => ['view' => 'datepicker'],
];

if (in_array($route, ['form', 'submit'], true) && !isset($scenarios[$name])) {
    http_response_code(404);
    echo "Unknown scenario {$name}.";

    return true;
}

define('YII_DEBUG', $variant === 'source');

require $root . '/tests/bootstrap.php';

$assetPath = "{$root}/runtime/browser-fixture/{$variant}/assets";
FileHelper::createDirectory($assetPath);

$application = new Application([
    'id' => 'dynamicform-browser-fixture',
    'basePath' => __DIR__,
    'vendorPath' => $root . '/vendor',
    'runtimePath' => $root . '/runtime/browser-fixture',
    'aliases' => ['@bower' => '@vendor/bower-asset', '@npm' => '@vendor/npm-asset'],
    'bootstrap' => ['log'],
    // Krajee widgets require a Bootstrap extension; yiisoft/yii2-bootstrap5 is the one installed for the fixture.
    'params' => ['bsVersion' => '5'],
    'components' => [
        'request' => [
            'cookieValidationKey' => 'dynamicform-browser-fixture',
            'baseUrl' => "/{$variant}",
            'scriptUrl' => "/{$variant}/index.php",
            'scriptFile' => __FILE__,
        ],
        'assetManager' => [
            'basePath' => $assetPath,
            'baseUrl' => "/runtime/browser-fixture/{$variant}/assets",
            'linkAssets' => true,
        ],
        'log' => [
            'targets' => [
                ['class' => StderrTarget::class, 'levels' => ['error', 'warning'], 'logVars' => []],
            ],
        ],
    ],
]);

if ($route === 'health') {
    header('Content-Type: text/plain');
    echo 'ok ' . PHP_VERSION . ' yii ' . Yii::getVersion();

    return true;
}

if ($route === 'depdrop' || $route === 'lookup') {
    $request = $application->getRequest();
    $data = $route === 'depdrop'
        ? KartikCatalog::dependent($name, $request->post('depdrop_parents'))
        : ($name === 'owners' ? KartikCatalog::owners($request->get('q')) : null);

    if ($data === null) {
        http_response_code(404);
        echo "Unknown list {$name}.";

        return true;
    }

    $response = $application->getResponse();
    $response->format = Response::FORMAT_JSON;
    $response->data = $data;
    $response->send();

    return true;
}

if ($route === 'submit') {
    $response = $application->getResponse();
    $response->format = Response::FORMAT_JSON;
    $response->data = ['scenario' => $name, 'debug' => YII_DEBUG, 'post' => $application->getRequest()->post()];
    $response->send();

    return true;
}

$scenario = array_replace(
    [
        'name' => $name,
        'clientValidation' => true,
        'clientScript' => true,
        'formId' => 'dynamic-form',
        'min' => 1,
        'persisted' => true,
        'loadGate' => false,
        'view' => 'form',
        'insertButton' => '.add-item',
        'deleteButton' => '.remove-item',
        'houses' => [['h0', ['r00']]],
        'sharedButtons' => false,
        'sameContainer' => false,
        'rowFormName' => 'FormModel',
        'codeKey' => '',
        'foreignContainer' => false,
        'submitUrl' => "/{$variant}/submit/{$name}",
        'endpointUrl' => "/{$variant}",
    ],
    $scenarios[$name],
);

$view = $application->getView();
$content = $view->renderFile(__DIR__ . "/views/fixture/{$scenario['view']}.php", ['scenario' => $scenario]);

echo $view->renderFile(__DIR__ . '/views/layouts/main.php', ['content' => $content]);

return true;
