<?php

declare(strict_types=1);

namespace Yii2\Extensions\DynamicForm\Tests\Support;

/**
 * Represents a stored row edited through Kartik Select2 and DepDrop controls.
 *
 * `branch` (single Select2 with placeholder), `tags` (multiple Select2), `owner` (Select2 with AJAX options) and
 * `country` (plain select) are edited directly; `region` (DepDrop) and `site` (DepDrop rendered as Select2) depend on
 * `country`.
 */
final class KartikFormModel extends PersistedFormModel
{
    /**
     * @var string|null
     */
    public $branch;
    /**
     * @var string|null
     */
    public $country;
    /**
     * @var string|null
     */
    public $owner;
    /**
     * @var string|null
     */
    public $region;
    /**
     * @var string|null
     */
    public $site;
    /**
     * @var string[]
     */
    public $tags = [];

    public function rules()
    {
        return [[['branch', 'country'], 'required'], [['tags', 'owner', 'region', 'site'], 'safe']];
    }
}
