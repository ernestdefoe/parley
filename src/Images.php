<?php

namespace Ernestdefoe\Parley;

use Flarum\Foundation\Paths;
use Flarum\Foundation\ValidationException;
use Flarum\Locale\TranslatorInterface;
use Flarum\Settings\SettingsRepositoryInterface;
use Psr\Http\Message\UploadedFileInterface;

/**
 * Pictures sent in a conversation.
 *
 * Stored under storage/, outside the web root, and only ever served through
 * ImageController after it checks the viewer is in the conversation. A
 * conversation is private; its pictures are too, not merely unlisted.
 */
class Images
{
    public const TYPES = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/gif' => 'gif',
        'image/webp' => 'webp',
    ];

    public function __construct(
        protected Paths $paths,
        protected SettingsRepositoryInterface $settings,
        protected TranslatorInterface $translator
    ) {
    }

    /** @return array{file: string, mime: string, w: int, h: int, size: int} */
    public function store(UploadedFileInterface $upload): array
    {
        $maxMb = max(1, (int) ($this->settings->get('ernestdefoe-parley.max_image_mb') ?: 8));

        if ($upload->getError() !== UPLOAD_ERR_OK) {
            $this->fail('upload_failed');
        }

        if ($upload->getSize() > $maxMb * 1024 * 1024) {
            $this->fail('image_too_big', ['max' => $maxMb]);
        }

        $tmp = tempnam(sys_get_temp_dir(), 'parley');
        $upload->moveTo($tmp);

        // The type is read from the bytes, never from the name or the browser's
        // claim about it.
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($tmp) ?: '';
        $size = @getimagesize($tmp);

        if (! isset(self::TYPES[$mime]) || ! $size) {
            @unlink($tmp);
            $this->fail('not_an_image');
        }

        $relative = date('Y/m').'/'.bin2hex(random_bytes(16)).'.'.self::TYPES[$mime];
        $target = $this->root().'/'.$relative;

        if (! is_dir(dirname($target))) {
            mkdir(dirname($target), 0775, true);
        }

        rename($tmp, $target);
        @chmod($target, 0664);

        return ['file' => $relative, 'mime' => $mime, 'w' => (int) $size[0], 'h' => (int) $size[1], 'size' => (int) filesize($target)];
    }

    public function path(string $relative): ?string
    {
        // A stored name is always yyyy/mm/<hex>.<ext>; anything else is not ours.
        if (! preg_match('~^\d{4}/\d{2}/[a-f0-9]{32}\.(jpg|png|gif|webp)$~', $relative)) {
            return null;
        }

        $path = $this->root().'/'.$relative;

        return is_file($path) ? $path : null;
    }

    private function root(): string
    {
        return $this->paths->storage.'/parley';
    }

    /** @return never */
    private function fail(string $key, array $params = []): void
    {
        throw new ValidationException(['image' => $this->translator->trans('ernestdefoe-parley.api.'.$key, $params)]);
    }
}
