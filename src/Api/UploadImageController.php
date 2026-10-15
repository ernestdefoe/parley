<?php

namespace Ernestdefoe\Parley\Api;

use Ernestdefoe\Parley\Conversations;
use Ernestdefoe\Parley\Images;
use Flarum\Foundation\ValidationException;
use Flarum\Locale\TranslatorInterface;
use Flarum\User\User;
use Illuminate\Support\Arr;
use Psr\Http\Message\ServerRequestInterface;

class UploadImageController extends Controller
{
    public function __construct(
        protected Conversations $conversations,
        protected Images $images,
        protected TranslatorInterface $translator,
    ) {
    }

    protected function respond(ServerRequestInterface $request, User $actor): mixed
    {
        $this->member($actor);
        $conversation = $this->conversations->find($this->routeId($request), $actor);

        $file = Arr::get($request->getUploadedFiles(), 'image');
        if (! $file) {
            throw new ValidationException(['image' => $this->translator->trans('ernestdefoe-parley.api.no_image')]);
        }

        $meta = $this->images->store($file);

        return ['message' => $this->conversations->send($conversation, $actor, 'image', null, $meta)];
    }
}
