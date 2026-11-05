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
 * posted payload as JSON. Assets are published below `runtime/browser-fixture`, which the built-in server serves itself.
 */

use yii\helpers\FileHelper;
use yii\web\{Application, Response};
use Yii2\Extensions\DynamicForm\Tests\Support\Browser\StderrTarget;

$root = dirname(__DIR__, 3);
$uri = $_SERVER['REQUEST_URI'] ?? '/';
$path = parse_url(is_string($uri) ? $uri : '/', PHP_URL_PATH);
$path = is_string($path) ? $path : '/';

if (str_starts_with($path, '/runtime/browser-fixture/') && is_file($root . $path)) {
    return false;
}

if (preg_match('#^/(source|production)/(health|form|submit)(?:/([\w-]+))?$#', $path, $match) !== 1) {
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
    // Insert selector containing double quotes, emitted by PHP into the click handler.
    'quoted-selector' => ['clientValidation' => false, 'insertButton' => 'button[data-role="add"]'],
    // Houses containing rooms: one outer and one inner widget, both rendered through begin()/end().
    'nested' => ['view' => 'nested'],
    // Two forms on one page, each with its own widget and model.
    'two-forms' => ['view' => 'two-forms'],
];

if ($route !== 'health' && !isset($scenarios[$name])) {
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
        'min' => 1,
        'persisted' => true,
        'loadGate' => false,
        'view' => 'form',
        'insertButton' => '.add-item',
        'submitUrl' => "/{$variant}/submit/{$name}",
    ],
    $scenarios[$name],
);

$view = $application->getView();
$content = $view->renderFile(__DIR__ . "/views/fixture/{$scenario['view']}.php", ['scenario' => $scenario]);

echo $view->renderFile(__DIR__ . '/views/layouts/main.php', ['content' => $content]);

return true;
