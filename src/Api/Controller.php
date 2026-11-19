<?php

namespace Ernestdefoe\Parley\Api;

use Ernestdefoe\Parley\Gate;
use Flarum\Http\RequestUtil;
use Flarum\User\Exception\NotAuthenticatedException;
use Flarum\User\Exception\PermissionDeniedException;
use Flarum\User\User;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * Parley's endpoints return plain JSON, not JSON:API. They are chat traffic —
 * small, frequent and shaped for one client — and none of them is a resource
 * another extension would want to include or filter.
 */
abstract class Controller implements RequestHandlerInterface
{
    /**
     * Each of Parley's controllers takes it in its constructor. A subclass in
     * another extension (Parley Calls) that predates that gets it from
     * ParleyServiceProvider instead, through withGate().
     */
    protected Gate $gate;

    /** @internal for ParleyServiceProvider */
    public function withGate(Gate $gate): void
    {
        if (! isset($this->gate)) {
            $this->gate = $gate;
        }
    }

    abstract protected function respond(ServerRequestInterface $request, User $actor): mixed;

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $result = $this->respond($request, $this->actor($request));

        return $result instanceof ResponseInterface ? $result : new JsonResponse($result ?? ['ok' => true]);
    }

    protected function actor(ServerRequestInterface $request): User
    {
        return RequestUtil::getActor($request);
    }

    protected function member(User $actor): void
    {
        if ($actor->isGuest()) {
            throw new NotAuthenticatedException();
        }

        if (! $this->gate->canUse($actor)) {
            throw new PermissionDeniedException();
        }
    }

    protected function body(ServerRequestInterface $request): array
    {
        return (array) $request->getParsedBody();
    }

    protected function input(ServerRequestInterface $request, string $key, mixed $default = null): mixed
    {
        return Arr::get($this->body($request), $key, $default);
    }

    protected function routeId(ServerRequestInterface $request, string $name = 'id'): int
    {
        return (int) Arr::get($request->getQueryParams(), $name);
    }

    protected function query(ServerRequestInterface $request, string $key): mixed
    {
        return Arr::get($request->getQueryParams(), $key);
    }
}
