<?php

declare(strict_types=1);

namespace Yii2\Extensions\DynamicForm\Tests\Support\Browser;

use function is_array;
use function is_string;
use function str_contains;
use function strtolower;

/**
 * Supplies the deterministic option lists of the Kartik scenario and the responses of its local AJAX endpoints.
 *
 * Options depending on a country are keyed `<country>-<suffix>`, so a response shows which parent value the request
 * carried.
 */
final class KartikCatalog
{
    /**
     * @var array<string, string>
     */
    public const BRANCHES = ['b1' => 'North', 'b2' => 'South', 'b3' => 'East'];
    /**
     * @var array<string, string>
     */
    public const COUNTRIES = ['es' => 'Spain', 'fr' => 'France', 'it' => 'Italy'];
    /**
     * @var array<string, string>
     */
    public const OWNERS = ['o1' => 'Owner one', 'o2' => 'Owner two', 'o3' => 'Owner three'];
    /**
     * @var array<string, string>
     */
    public const TAGS = ['t1' => 'Red', 't2' => 'Green', 't3' => 'Blue'];
    /**
     * @var array<string, array<string, string>>
     */
    private const DEPENDENT = [
        'regions' => ['north' => 'North region', 'south' => 'South region'],
        'sites' => ['main' => 'Main site', 'depot' => 'Depot'],
    ];

    /**
     * Returns the DepDrop response of a dependent list for the posted parent value, or `null` for an unknown list.
     *
     * @return array{output: list<array{id: string, name: string}>, selected: string}|null
     */
    public static function dependent(string $list, mixed $parents): array|null
    {
        if (!isset(self::DEPENDENT[$list])) {
            return null;
        }

        $country = is_array($parents) && isset($parents[0]) && is_string($parents[0]) ? $parents[0] : '';

        $output = [];

        if (isset(self::COUNTRIES[$country])) {
            foreach (self::DEPENDENT[$list] as $id => $name) {
                $output[] = ['id' => "{$country}-{$id}", 'name' => "{$name} {$country}"];
            }
        }

        return ['output' => $output, 'selected' => ''];
    }

    /**
     * Returns the options of a dependent list for a country, as DepDrop renders them on the server.
     *
     * @return array<string, string>
     */
    public static function dependentOptions(string $list, string $country): array
    {
        $options = [];

        foreach (self::dependent($list, [$country])['output'] ?? [] as $option) {
            $options[$option['id']] = $option['name'];
        }

        return $options;
    }

    /**
     * Returns the Select2 AJAX response of the owners whose name contains the search term.
     *
     * @return array{results: list<array{id: string, text: string}>}
     */
    public static function owners(mixed $term): array
    {
        $term = is_string($term) ? strtolower($term) : '';

        $results = [];

        foreach (self::OWNERS as $id => $text) {
            if ($term === '' || str_contains(strtolower($text), $term)) {
                $results[] = ['id' => $id, 'text' => $text];
            }
        }

        return ['results' => $results];
    }
}
