<?php

declare(strict_types=1);

/**
 * Verifies that the isolated tool graph does not shadow the root runtime/test graph.
 *
 * Run from the repository root on the tool host after installing both graphs:
 *
 *     php tools/verify-graph.php [--json=path]
 *
 * The script registers the root autoloader first and the tool autoloader second, which is the order used by the
 * installed PHPStan launcher. Composer prepends each loader, so a package present in both graphs would be loaded from
 * the tool graph. Every target class must therefore resolve inside the root checkout.
 */

$root = dirname(__DIR__);
$tools = __DIR__;
$failures = [];
$report = ['php' => PHP_VERSION, 'os' => PHP_OS_FAMILY, 'root' => $root];

/**
 * @return array<string, array<string, mixed>>
 */
$readInstalled = static function (string $vendor) use (&$failures): array {
    $file = $vendor . '/composer/installed.php';

    if (!is_file($file)) {
        $failures[] = "Missing Composer metadata: {$file}.";

        return [];
    }

    /** @var array{versions: array<string, array<string, mixed>>} $data */
    $data = require $file;

    return $data['versions'];
};

$rootInstalled = $readInstalled($root . '/vendor');
$toolInstalled = $readInstalled($tools . '/vendor');

if ($failures !== []) {
    fwrite(STDERR, implode(PHP_EOL, $failures) . PHP_EOL);
    exit(1);
}

/** @var array{extra: array{dynamicform-tools: array{forbidden-packages: list<string>, root-constraints-from: array<string, string>}}} $manifest */
$manifest = json_decode((string) file_get_contents($tools . '/composer.json'), true, 512, JSON_THROW_ON_ERROR);
$policy = $manifest['extra']['dynamicform-tools'];

foreach ($policy['forbidden-packages'] as $package) {
    $installPath = $toolInstalled[$package]['install_path'] ?? null;

    if (is_string($installPath) && is_dir($installPath)) {
        $failures[] = "Tool graph installs {$package} at {$installPath}; it must come from the root graph.";
    }

    if (!isset($rootInstalled[$package]['install_path'])) {
        $failures[] = "Root graph does not install {$package}.";
    }

    $report['packages'][$package] = [
        'root' => $rootInstalled[$package]['pretty_version'] ?? null,
        'tools' => isset($toolInstalled[$package]['install_path']) ? $toolInstalled[$package]['pretty_version'] : 'not installed',
    ];
}

// Reproduce the PHPStan launcher order: root autoloader first, tool autoloader second (prepended, highest priority).
require $root . '/vendor/autoload.php';
require $tools . '/vendor/autoload.php';

foreach ($policy['root-constraints-from'] as $toolPackage => $rootPackage) {
    /** @var array{require: array<string, string>} $toolComposer */
    $toolComposer = json_decode(
        (string) file_get_contents($tools . '/vendor/' . $toolPackage . '/composer.json'),
        true,
        512,
        JSON_THROW_ON_ERROR,
    );
    $constraint = $toolComposer['require'][$rootPackage] ?? '*';
    $version = (string) ($rootInstalled[$rootPackage]['version'] ?? '');
    $satisfied = $version !== '' && \Composer\Semver\Semver::satisfies($version, $constraint);

    if (!$satisfied) {
        $failures[] = "Root {$rootPackage} {$version} does not satisfy {$toolPackage} requirement {$constraint}.";
    }

    $report['constraints'][] = compact('toolPackage', 'rootPackage', 'constraint', 'version', 'satisfied');
}

$classes = [
    'yii\\BaseYii' => $root . '/vendor/',
    'yii\\base\\Widget' => $root . '/vendor/',
    'yii\\widgets\\ActiveForm' => $root . '/vendor/',
    'PHPUnit\\Framework\\TestCase' => $root . '/vendor/',
    'Symfony\\Component\\DomCrawler\\Crawler' => $root . '/vendor/',
    'Yii2\\Extensions\\DynamicForm\\DynamicFormWidget' => $root . '/src/',
    'Yii2\\Extensions\\DynamicForm\\Tests\\Support\\TestCase' => $root . '/tests/',
];

foreach ($classes as $class => $expectedPrefix) {
    $file = null;

    foreach (spl_autoload_functions() as $loader) {
        if (is_array($loader) && $loader[0] instanceof \Composer\Autoload\ClassLoader) {
            $file = $loader[0]->findFile($class);

            if ($file !== false) {
                break;
            }
        }
    }

    $resolved = is_string($file) ? (realpath($file) ?: $file) : null;
    $ok = $resolved !== null && str_starts_with($resolved, realpath($expectedPrefix) ?: $expectedPrefix);

    if (!$ok) {
        $failures[] = "{$class} resolves to " . ($resolved ?? 'nothing') . ", expected under {$expectedPrefix}.";
    }

    $report['classes'][$class] = $resolved;
}

// Packages installed in both graphs resolve from the tool graph inside tool processes; report them for review.
foreach ($toolInstalled as $package => $data) {
    if (isset($data['install_path'], $rootInstalled[$package]['install_path']) && $package !== '__root__') {
        $report['overlap'][$package] = [
            'root' => $rootInstalled[$package]['pretty_version'] ?? null,
            'tools' => $data['pretty_version'] ?? null,
        ];
    }
}

$report['failures'] = $failures;
$encoded = json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . PHP_EOL;

foreach ($argv as $argument) {
    if (str_starts_with($argument, '--json=')) {
        file_put_contents(substr($argument, 7), $encoded);
    }
}

echo $encoded;

exit($failures === [] ? 0 : 1);
