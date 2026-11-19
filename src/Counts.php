<?php

namespace Ernestdefoe\Parley;

use Illuminate\Database\Query\Builder;

/**
 * Grouped counts: the one place Parley writes an aggregate in SQL. The query
 * builder has no grouped count of its own, and one grouped query beats one
 * count per conversation.
 */
class Counts
{
    /**
     * @param  Builder  $query  filtered rows; grouped here by $group
     * @param  string|null  $distinct  count distinct values of this column instead of rows
     * @return array<int, int> group value => count
     */
    public static function by(Builder $query, string $group, ?string $distinct = null): array
    {
        $grammar = $query->getGrammar();
        $count = $distinct === null ? 'count(*)' : 'count(distinct '.$grammar->wrap($distinct).')';

        $out = [];
        foreach ($query->groupBy($group)->select($group.' as cid')->selectRaw($count.' as n')->get() as $row) {
            $out[(int) $row->cid] = (int) $row->n;
        }

        return $out;
    }
}
