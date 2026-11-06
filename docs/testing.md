# Testing

This package provides a consistent set of [Composer](https://getcomposer.org/) scripts for local validation, plus
[npm](https://www.npmjs.com/) scripts for the jQuery plugin and the browser acceptance tests. Applications install only
the PHP package.

Tool references:

- [Actionlint](https://github.com/rhysd/actionlint) for GitHub Actions workflow linting.
- [Codespell](https://github.com/codespell-project/codespell) for spelling checks.
- [Composer Require Checker](https://github.com/maglnet/ComposerRequireChecker) for dependency definition checks.
- [Easy Coding Standard (ECS)](https://github.com/easy-coding-standard/easy-coding-standard) for coding standards.
- [EditorConfig Checker](https://github.com/editorconfig-checker/editorconfig-checker) for EditorConfig compliance.
- [ESLint](https://eslint.org/) for JavaScript linting.
- [Gitleaks](https://github.com/gitleaks/gitleaks) for secret scanning.
- [Infection](https://infection.github.io/) for PHP mutation testing.
- [Markdownlint-cli2](https://github.com/DavidAnson/markdownlint-cli2) for Markdown linting.
- [PHPStan](https://phpstan.org/) for static analysis.
- [PHPUnit](https://phpunit.de/) for unit tests.
- [Playwright](https://playwright.dev/) for PHP-rendered browser acceptance tests.
- [Prettier](https://prettier.io/) for Markdown and YAML formatting checks.
- [StrykerJS](https://stryker-mutator.io/) for JavaScript mutation testing.
- [Vitest](https://vitest.dev/) with [jsdom](https://github.com/jsdom/jsdom) for JavaScript unit tests.
- [Yamllint](https://github.com/adrienverge/yamllint) for YAML linting.
- [Zizmor](https://github.com/zizmorcore/zizmor) for GitHub Actions security audits.

## Automated refactoring (Rector)

The `rector` and `rector-check` scripts have no `rector.php` configuration yet; they are not part of the checks.

## Coding standards (ECS)

Check coding standards without modifying files.

```bash
composer ecs-check
```

Apply coding standard fixes. Review the changes before keeping them.

```bash
composer ecs
```

## Dependency definition check

Verify that runtime dependencies are correctly declared in `composer.json`.

```bash
composer check-dependencies
```

## Mutation testing (Infection)

Run mutation testing.

```bash
composer mutation
```

Run mutation testing with PHPStan static analysis enabled.

```bash
composer mutation-static
```

Options live in `infection.json5`; the reports are written to `runtime/infection`.

## Repository quality checks

Make the CLI tools used by the shared quality workflow available on `PATH`: actionlint with its ShellCheck helper,
codespell, EditorConfig Checker, markdownlint-cli2, Prettier and yamllint. Run all checks:

```bash
composer quality
```

Each tool also has its own script:

```bash
composer actionlint
composer codespell
composer editorconfig-checker
composer markdownlint
composer prettier
composer yamllint
```

The linter configuration lives in `.github/linters`, and the Prettier configuration in `.prettierrc.json` and
`.prettierignore`. CI uses the same files.

## Static analysis (PHPStan)

Run static analysis.

```bash
composer static
```

## Unit tests (PHPUnit)

Run the full test suite.

```bash
composer tests
```

Run one group (`api`, `asset`, `model`, `widget`).

```bash
composer tests -- --group widget
```

The production-mode asset cases need the [runkit7](https://github.com/runkit7/runkit7) extension, as in CI; PHPUnit
skips them without it.

## Workflow security checks

Make zizmor and Gitleaks available on `PATH`. Audit the current workflow files with the same pedantic persona used by
the shared security workflow:

```bash
composer zizmor
```

Scan Git history for secrets with the repository's Gitleaks configuration:

```bash
composer gitleaks
```

Run both checks. Findings make the command fail; inspect them rather than disabling the checks.

```bash
composer security
```

Zizmor needs GitHub API access for its online audits. If the tool runs offline, report that limit separately. To request
an offline audit explicitly:

```bash
composer zizmor -- --offline
```

Report hosted CI execution and its PHP/OS matrix separately from these local commands. Keep generated reports in ignored
`internal/`.

## Passing extra arguments

Composer scripts support forwarding additional arguments using `--`.

Run PHPUnit with code coverage report generation.

```bash
composer tests -- --coverage-html internal/coverage
```

Run one PHPUnit test class.

```bash
composer tests -- --filter DynamicFormWidgetTest
```

## JavaScript tests (Vitest)

Install the Node.js toolchain (see `.nvmrc`) and the PHP dependencies, because the tests load Yii's client scripts from
`vendor/yiisoft/yii2`. Run every project (`source`, `source-script`, `production`) with the coverage thresholds of
`vitest.config.mjs`:

```bash
composer update
npm ci
npm run test:js
```

Run one project:

```bash
npx vitest run --project production
```

`tests/js/kartik.test.js` also loads the Kartik scripts that `composer update` installs from the pinned development
dependencies (see [Third-party integrations](#third-party-integrations)).

Tests registered as known defects pass while the defect reproduces; report them as failures instead:

```bash
npm run test:js:strict
```

## JavaScript mutation testing (Stryker)

Run mutation testing for the plugin source. Thresholds live in `stryker.config.mjs`; the report is written to
`runtime/stryker`.

```bash
npm run test:mutation
```

## JavaScript linting (ESLint)

Lint the plugin, the tests, the tools and the configuration files with `.github/linters/eslint.config.mjs`.

```bash
npm run lint
```

## Browser acceptance tests (Playwright)

Install Chromium once, then run both asset variants. Playwright starts the PHP built-in server with
`tests/Support/Browser/router.php`.

```bash
npx playwright install chromium
npm run test:browser
```

Environment variables:

- `PHP_BINARY`: PHP executable that serves the fixture (default `php`).
- `DYNAMICFORM_BASE_URL`: use an already running fixture server instead, for example a PHP 8.1 container.
- `CHROMIUM_PATH`: use an installed Chromium instead of the Playwright download.

```bash
php -S 127.0.0.1:8181 tests/Support/Browser/router.php
DYNAMICFORM_BASE_URL=http://127.0.0.1:8181 npx playwright test
```

Run only the Kartik Select2 and DepDrop acceptance tests:

```bash
npx playwright test tests/browser/rendered-kartik.spec.mjs
```

## Third-party integrations

Integration tests run against real, pinned library versions; no plugin is replaced by a stub. The `kartik` browser
scenario renders the widgets through `ActiveForm::field()->widget()`, and its DepDrop requests and Select2 AJAX searches
are answered by deterministic endpoints of `tests/Support/Browser/router.php`, so no external service is contacted.

| Library                                                                         | Version | Installed by                                           |
| ------------------------------------------------------------------------------- | ------- | ------------------------------------------------------ |
| [Select2](https://github.com/select2/select2)                                   | 4.0.13  | npm (`select2`) and Composer (`select2/select2`)       |
| [kartik-v/yii2-widget-select2](https://github.com/kartik-v/yii2-widget-select2) | 2.2.5   | Composer                                               |
| [kartik-v/yii2-widget-depdrop](https://github.com/kartik-v/yii2-widget-depdrop) | 1.0.6   | Composer                                               |
| [kartik-v/dependent-dropdown](https://github.com/kartik-v/dependent-dropdown)   | 1.4.9   | Composer                                               |
| [kartik-v/yii2-krajee-base](https://github.com/kartik-v/yii2-krajee-base)       | 3.0.5   | Composer                                               |
| [yiisoft/yii2-bootstrap5](https://github.com/yiisoft/yii2-bootstrap5)           | ^2.0.50 | Composer; Krajee widgets require a Bootstrap extension |

Other versions and the remaining advertised integrations (TomSelect, Inputmask, date and time pickers, maskMoney,
fileinput, TouchSpin, Spectrum, NumberControl) are not covered by these tests.

With `YII_DEBUG=false`, Kartik registers `depdrop.min.js` of yii2-widget-depdrop 1.0.6, an older build that listens to
event names dependent-dropdown 1.4.9 no longer triggers; its Select2 loading handling therefore does not run in the
`production` project, for original and inserted rows alike.

## Minified asset

Regenerate the committed `src/assets/yii2-dynamic-form.min.js` after editing the plugin; the `assets` workflow fails
when the committed file differs from a fresh build.

```bash
npm run build
```

[Back to documentation](../README.md#documentation)
