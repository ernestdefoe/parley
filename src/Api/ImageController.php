<?php

namespace Ernestdefoe\Parley\Api;

use Ernestdefoe\Parley\Conversations;
use Ernestdefoe\Parley\Images;
use Flarum\User\User;
use GuzzleHttp\Psr7\LimitStream;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Laminas\Diactoros\Response;
use Laminas\Diactoros\Stream;
use Psr\Http\Message\ServerRequestInterface;

/**
 * Serves what was sent in a conversation — /files/{message id}, and the older
 * /images/{message id} — to people who may read that conversation, and to
 * nobody else: a stranger gets the same 404 as a message that does not exist.
 *
 * 🚨 Served as the type its stored extension says, which was decided from the
 * bytes when it was kept, never from what the sender claimed. Files are a
 * download (`attachment`); pictures, video and voice show in the page. Every
 * response carries nosniff and a sandboxing policy, so even a file opened on
 * its own can run nothing.
 *
 * Byte ranges are honoured: Safari will not play a video or a voice note
 * from a server that ignores them.
 */
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

        if (! $message || ! in_array($message->type, ['image', 'video', 'voice', 'file'], true) || $message->deleted_at
            || ! $this->conversations->canSee((int) $message->conversation_id, $actor)) {
            throw new ModelNotFoundException();
        }

        $meta = json_decode((string) $message->meta, true) ?: [];
        $file = (string) ($meta['file'] ?? '');
        $path = $this->images->path($file);

        if (! $path) {
            throw new ModelNotFoundException();
        }

        $size = (int) filesize($path);
        $type = $this->images->servedType($file);
        $name = (string) ($meta['name'] ?? basename($file));
        $disposition = $message->type === 'file' ? 'attachment' : 'inline';

        $response = (new Response())
            ->withHeader('Content-Type', $type)
            ->withHeader('Content-Disposition', $disposition.'; filename="'.addcslashes(preg_replace('/[^\x20-\x7E]/', '_', $name) ?? 'file', '"\\').'"; filename*=UTF-8\'\''.rawurlencode($name))
            ->withHeader('Accept-Ranges', 'bytes')
            // Private: a shared cache must never hand one member's file to another.
            ->withHeader('Cache-Control', 'private, max-age=86400')
            ->withHeader('X-Content-Type-Options', 'nosniff')
            ->withHeader('Content-Security-Policy', "default-src 'none'; sandbox");

        $stream = new Stream($path, 'r');
        $range = $request->getHeaderLine('Range');

        if ($range && preg_match('/^bytes=(\d*)-(\d*)$/', trim($range), $m) && ($m[1] !== '' || $m[2] !== '')) {
            if ($m[1] === '') {
                // The last N bytes.
                $start = max(0, $size - (int) $m[2]);
                $end = $size - 1;
            } else {
                $start = (int) $m[1];
                $end = $m[2] === '' ? $size - 1 : min((int) $m[2], $size - 1);
            }

            if ($start > $end || $start >= $size) {
                return $response->withStatus(416)->withHeader('Content-Range', "bytes */$size");
            }

            return $response->withStatus(206)
                ->withBody(new LimitStream($stream, $end - $start + 1, $start))
                ->withHeader('Content-Range', "bytes $start-$end/$size")
                ->withHeader('Content-Length', (string) ($end - $start + 1));
        }

        return $response->withBody($stream)->withHeader('Content-Length', (string) $size);
    }
}
