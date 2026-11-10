<!-- markdownlint-disable MD041 -->
<p align="center">
    <picture>
        <source media="(prefers-color-scheme: dark)" srcset="https://www.yiiframework.com/image/design/logo/yii3_full_for_dark.svg">
        <source media="(prefers-color-scheme: light)" srcset="https://www.yiiframework.com/image/design/logo/yii3_full_for_light.svg">
        <img src="https://www.yiiframework.com/image/design/logo/yii3_full_for_dark.svg" alt="Yii Framework" width="80%">
    </picture>
    <h1 align="center">Dynamic form</h1>
    <br>
</p>
<!-- markdownlint-enable MD041 -->

<p align="center">
    <a href="https://github.com/yii2-extensions/dynamicform/actions/workflows/build.yml" target="_blank">
        <img src="https://img.shields.io/github/actions/workflow/status/yii2-extensions/dynamicform/build.yml?style=for-the-badge&label=PHPUnit&logo=github" alt="PHPUnit">
    </a>
    <a href="https://dashboard.stryker-mutator.io/reports/github.com/yii2-extensions/dynamicform/main" target="_blank">
        <img src="https://img.shields.io/endpoint?style=for-the-badge&url=https%3A%2F%2Fbadge-api.stryker-mutator.io%2Fgithub.com%2Fyii2-extensions%2Fdynamicform%2Fmain" alt="Mutation Testing">
    </a>
    <a href="https://github.com/yii2-extensions/dynamicform/actions/workflows/static.yml" target="_blank">
        <img src="https://img.shields.io/github/actions/workflow/status/yii2-extensions/dynamicform/static.yml?style=for-the-badge&label=PHPStan&logo=github" alt="PHPStan">
    </a>
    <a href="https://github.com/yii2-extensions/dynamicform/actions/workflows/security.yml" target="_blank">
        <img src="https://img.shields.io/github/actions/workflow/status/yii2-extensions/dynamicform/security.yml?style=for-the-badge&label=Security&logo=github" alt="Security">
    </a>
</p>

<p align="center">
    <strong>Clone nested form rows in Yii2 ActiveForm</strong><br>
    <em>Tabular inputs, client validation, nested widgets and jQuery events</em>
</p>

Add and remove rows of form fields in the browser while the tabular input names, ids and client validation stay
coherent. The widget wraps the rows rendered by `ActiveForm`, and the `Model` helper rebuilds the posted rows on the
server.

<picture>
    <source media="(prefers-color-scheme: dark)" srcset="images/dynamicform-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="images/dynamicform-light.png">
    <img src="images/dynamicform-light.png" alt="Example application with nested property and room fields, live totals and custom styling">
</picture>

## Quick start

### Installation

```bash
composer require --prefer-dist yii2-extensions/dynamicform:^2.0
```

### Basic usage

Wrap the rows of a tabular form with `DynamicFormWidget::begin()` and `end()`:

```php
use yii\helpers\Html;
use yii\widgets\ActiveForm;
use Yii2\Extensions\DynamicForm\DynamicFormWidget;

$form = ActiveForm::begin(['id' => 'dynamic-form']);

DynamicFormWidget::begin(
    [
        'widgetContainer' => 'dynamicform_wrapper',
        'widgetBody' => '.container-items',
        'widgetItem' => '.item',
        'limit' => 4,
        'min' => 1,
        'insertButton' => '.add-item',
        'deleteButton' => '.remove-item',
        'model' => $modelsAddress[0],
        'formId' => 'dynamic-form',
        'formFields' => ['full_name', 'city'],
    ],
);
?>
<div class="container-items">
    <?php foreach ($modelsAddress as $i => $modelAddress): ?>
        <div class="item">
            <?= $form->field($modelAddress, "[{$i}]full_name")->textInput() ?>
            <?= $form->field($modelAddress, "[{$i}]city")->textInput() ?>
            <button type="button" class="add-item">+</button>
            <button type="button" class="remove-item">-</button>
        </div>
    <?php endforeach; ?>
</div>
<?php
DynamicFormWidget::end();

echo Html::submitButton('Save');

ActiveForm::end();
```

On the server, `Model::createMultiple()` builds one `Address` model per posted row; the
[usage examples](docs/examples.md) show the complete create and update actions.

## Documentation

- 📚 [Installation guide](docs/installation.md)
- ⚙️ [Configuration guide](docs/configuration.md)
- 💡 [Usage examples](docs/examples.md)
- 🧪 [Testing guide](docs/testing.md)

## AI assistance

AI agents: read the [documentation index](https://yii2-framework.github.io/docs/llms.txt) and fetch the Markdown version
of a page by appending `index.md` to its URL. The
[AI agents guide](https://yii2-framework.github.io/docs/project/ai-agents/) covers skill installation, client setup and
verification.

- 🤖 [`yii2-dynamicform` skill](docs/agents.md): Dynamic form rows.
- 🧭 [`yii2-framework` skill](https://yii2-framework.github.io/docs/guide/skills/yii2-framework/): Yii 22.0 application
  conventions.

The hosted documentation covers Yii 22.0. If it does not match the installed revision or is unavailable, use the
[repository guides](#documentation), the [skill source](skills/yii2-dynamicform/SKILL.md), the source PHPDoc and the
[changelog](CHANGELOG.md).

## Package information

[![PHP](https://img.shields.io/badge/%3E%3D8.1-777BB4.svg?style=for-the-badge&logo=php&logoColor=white)](https://www.php.net/releases/8.1/en.php)
[![Yii 2.0.55+](https://img.shields.io/badge/%3E%3D2.0.55-0073AA.svg?style=for-the-badge&logo=yii&logoColor=white)](https://github.com/yiisoft/yii2/releases/tag/2.0.55)
[![Yii 22.0.x](https://img.shields.io/badge/22.0.x-0073AA.svg?style=for-the-badge&logo=yii&logoColor=white)](https://github.com/yiisoft/yii2/tree/22.0)
[![Latest Stable Version](https://img.shields.io/packagist/v/yii2-extensions/dynamicform.svg?style=for-the-badge&logo=packagist&logoColor=white&label=Stable)](https://packagist.org/packages/yii2-extensions/dynamicform)
[![Total Downloads](https://img.shields.io/packagist/dt/yii2-extensions/dynamicform.svg?style=for-the-badge&logo=composer&logoColor=white&label=Downloads)](https://packagist.org/packages/yii2-extensions/dynamicform)
[![PHPStan Level Max](https://img.shields.io/badge/PHPStan-Level%20Max-4F5D95.svg?style=for-the-badge&logo=github&logoColor=white)](https://github.com/yii2-extensions/dynamicform/actions/workflows/static.yml)

## Code quality

[![Codecov](https://img.shields.io/codecov/c/github/yii2-extensions/dynamicform.svg?style=for-the-badge&logo=codecov&logoColor=white&label=Coverage)](https://codecov.io/github/yii2-extensions/dynamicform)
[![Quality](https://img.shields.io/github/actions/workflow/status/yii2-extensions/dynamicform/quality.yml?style=for-the-badge&label=Quality&logo=github)](https://github.com/yii2-extensions/dynamicform/actions/workflows/quality.yml)
[![Assets](https://img.shields.io/github/actions/workflow/status/yii2-extensions/dynamicform/assets.yml?style=for-the-badge&label=Assets&logo=github)](https://github.com/yii2-extensions/dynamicform/actions/workflows/assets.yml)
[![ECS](https://img.shields.io/github/actions/workflow/status/yii2-extensions/dynamicform/ecs.yml?style=for-the-badge&label=ECS&logo=github)](https://github.com/yii2-extensions/dynamicform/actions/workflows/ecs.yml)

## Special thanks

This extension was created by Wanderson Bragança and hosted at
[wbraganca/yii2-dynamicform](https://github.com/wbraganca/yii2-dynamicform). We thank him for his work; for continuity
and maintenance we have moved a copy here and preserve his identity throughout the code he wrote.

## Our social networks

[![Follow on X](https://img.shields.io/badge/-Follow%20on%20X-1DA1F2.svg?style=for-the-badge&logo=x&logoColor=white&labelColor=000000)](https://x.com/Terabytesoftw)
[![Follow on Facebook](https://img.shields.io/badge/-Follow%20on%20Facebook-1877F2.svg?style=for-the-badge&logo=facebook&logoColor=white&labelColor=000000)](https://www.facebook.com/wilmer.arambula.9)
[![Join our Subreddit](https://img.shields.io/badge/-Join%20our%20Subreddit-FF4500.svg?style=for-the-badge&logo=reddit&logoColor=white&labelColor=000000)](https://www.reddit.com/r/Yii2/)
[![Join on Telegram](https://img.shields.io/badge/-Join%20on%20Telegram-26A5E4.svg?style=for-the-badge&logo=telegram&logoColor=white&labelColor=000000)](https://t.me/yii_framework_in_english)

## Built with AI

[![Built with Claude Code](https://img.shields.io/badge/Built%20with-Claude%20Code-D97757.svg?style=for-the-badge&logo=claude&logoColor=white)](https://claude.com/claude-code)
[![Built with Codex](https://img.shields.io/badge/Built%20with-Codex-10A37F.svg?style=for-the-badge&logo=openaigym&logoColor=white)](https://openai.com/codex)
[![Reviewed by CodeRabbit](https://img.shields.io/badge/Reviewed%20by-CodeRabbit-FF570A.svg?style=for-the-badge&logo=coderabbit&logoColor=white)](https://www.coderabbit.ai)

## License

[![License](https://img.shields.io/badge/License-BSD--3--Clause-brightgreen.svg?style=for-the-badge&logo=opensourceinitiative&logoColor=white&labelColor=555555)](LICENSE.md)
