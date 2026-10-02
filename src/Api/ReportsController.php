<?php

namespace Ernestdefoe\Parley\Api;

use Ernestdefoe\Parley\Gate;
use Ernestdefoe\Parley\Reports;
use Flarum\User\User;
use Psr\Http\Message\ServerRequestInterface;

/**
 * POST /parley/messages/{id}/report — any participant, about someone else's message.
 * GET  /parley/reports               — the open queue, for moderators.
 * POST /parley/reports/{id}/resolve  — close one.
 */
class ReportsController extends Controller
{
    public function __construct(
        protected Reports $reports
    ) {
    }

    protected function respond(ServerRequestInterface $request, User $actor): mixed
    {
        $this->member($actor);
        $route = $request->getAttribute('routeName');

        if ($route === 'ernestdefoe-parley.report') {
            $this->reports->file($this->routeId($request), $actor, $this->input($request, 'reason'));

            return ['ok' => true];
        }

        $actor->assertCan(Gate::MODERATE);

        if ($route === 'ernestdefoe-parley.reports.resolve') {
            $this->reports->resolve($this->routeId($request), $actor);
        }

        return ['reports' => $this->reports->open()];
    }
}
