<?php

namespace Ernestdefoe\Parley\Api;

use Ernestdefoe\Parley\Conversations;
use Ernestdefoe\Parley\Images;
use Flarum\User\User;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Laminas\Diactoros\Response;
use Laminas\Diactoros\Stream;
use Psr\Http\Message\ServerRequestInterface;

class ImageController extends Controller
{
    public function __construct(
        protected Conversations $conversations,
        protected Images $images
    ) {
    }

    protected function respond(ServerRequestInterface $request, User $actor): mixed
    {
        $this->member($actor);

        $message = $this->conversations->message($this->routeId($request));

        if (! $message || $message->type !== 'image' || $message->deleted_at
            || ! $this->conversations->isParticipant((int) $message->conversation_id, $actor->id)) {
            throw new ModelNotFoundException();
        }

        $meta = json_decode((string) $message->meta, true) ?: [];
        $path = $this->images->path((string) ($meta['file'] ?? ''));

        if (! $path) {
            throw new ModelNotFoundException();
        }

        return (new Response(new Stream($path, 'r'), 200))
            ->withHeader('Content-Type', (string) ($meta['mime'] ?? 'application/octet-stream'))
            ->withHeader('Content-Length', (string) filesize($path))
            // Private: a shared cache must never hand one member's picture to another.
            ->withHeader('Cache-Control', 'private, max-age=86400')
            ->withHeader('X-Content-Type-Options', 'nosniff');
    }
}
