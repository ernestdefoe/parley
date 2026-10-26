<?php

namespace Ernestdefoe\Parley\Api;

use Ernestdefoe\Parley\Search;
use Flarum\User\User;
use Psr\Http\Message\ServerRequestInterface;

/** GET /search?q=&conversation=&from=&type=&since=&until=&before= */
class SearchController extends Controller
{
    public function __construct(
        protected Search $search
    ) {
    }

    protected function respond(ServerRequestInterface $request, User $actor): mixed
    {
        $this->member($actor);
        $p = $request->getQueryParams();

        return $this->search->run($actor, [
            'q' => mb_substr((string) ($p['q'] ?? ''), 0, 100),
            'conversation' => (int) ($p['conversation'] ?? 0) ?: null,
            'from' => (int) ($p['from'] ?? 0) ?: null,
            'type' => isset($p['type']) ? (string) $p['type'] : null,
            'since' => isset($p['since']) ? (string) $p['since'] : null,
            'until' => isset($p['until']) ? (string) $p['until'] : null,
            'before' => (int) ($p['before'] ?? 0) ?: null,
        ]);
    }
}
