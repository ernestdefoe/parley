<?php

namespace Ernestdefoe\Parley\Api;

use Ernestdefoe\Parley\Conversations;
use Ernestdefoe\Parley\Gate;
use Ernestdefoe\Parley\Images;
use Ernestdefoe\Parley\RateLimit;
use Flarum\Foundation\ValidationException;
use Flarum\Locale\TranslatorInterface;
use Flarum\User\User;
use Illuminate\Support\Arr;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Message\UploadedFileInterface;

/**
 * A photo, video, voice note or file sent in a conversation: `file`, with
 * `kind` (image | video | voice | file) and, for a voice note, `seconds`.
 */
class UploadFileController extends Controller
{
    public function __construct(
        protected Gate $gate,
        protected Conversations $conversations,
        protected Images $files,
        protected TranslatorInterface $translator,
        protected RateLimit $rateLimit
    ) {
    }

    protected function respond(ServerRequestInterface $request, User $actor): mixed
    {
        $this->member($actor);
        $conversation = $this->conversations->find($this->routeId($request), $actor);

        $file = Arr::get($request->getUploadedFiles(), 'file');
        if (! $file instanceof UploadedFileInterface) {
            throw new ValidationException(['file' => $this->translator->trans('ernestdefoe-parley.api.no_file')]);
        }

        // Thirty uploads in ten minutes; the message flood limit applies too.
        $this->rateLimit->hit('uploads', $actor->id, 30, 600);

        $kind = (string) $this->input($request, 'kind', 'file');
        $kind = in_array($kind, ['image', 'video', 'voice', 'file'], true) ? $kind : 'file';
        $seconds = $this->input($request, 'seconds');

        $meta = $this->files->keep($file, $kind, is_numeric($seconds) ? (float) $seconds : null);
        $type = $meta['type'];
        unset($meta['type']);

        // A file's name is its words, so a search for it finds it.
        $body = $type === 'file' ? ($meta['name'] ?? null) : null;

        return ['message' => $this->conversations->send(
            $conversation,
            $actor,
            $type,
            $body,
            $meta,
            null,
            ($nonce = $this->input($request, 'nonce')) ? (string) $nonce : null
        )];
    }
}
