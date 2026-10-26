<?php

namespace Ernestdefoe\Parley;

use Flarum\Foundation\ValidationException;
use Flarum\Locale\TranslatorInterface;
use Illuminate\Contracts\Filesystem\Cloud;
use Illuminate\Contracts\Filesystem\Factory;
use Intervention\Image\ImageManager;
use Psr\Http\Message\UploadedFileInterface;

/**
 * A group conversation's photo: a 256px square WebP in the forum's assets,
 * under a random name, the way core keeps members' avatars.
 */
class GroupPhotos
{
    public const SIZE = 256;

    public const MAX_MB = 5;

    /** The shape of every name set() writes. */
    public const NAME = '~^parley/groups/[a-f0-9]{32}\.webp$~D';

    public function __construct(
        protected Factory $filesystems,
        protected ImageManager $images,
        protected TranslatorInterface $translator
    ) {
    }

    /** @return string the stored path, relative to the assets disk */
    public function store(UploadedFileInterface $upload, ?string $replacing): string
    {
        $tmp = tempnam(sys_get_temp_dir(), 'parley');

        try {
            if ($upload->getError() !== UPLOAD_ERR_OK || $upload->getSize() > self::MAX_MB * 1024 * 1024) {
                $this->fail();
            }

            $upload->moveTo($tmp);
            $path = $this->storeFile($tmp);
        } finally {
            @unlink($tmp);
        }

        $this->remove($replacing);

        return $path;
    }

    /** Keep a picture already on disk as a group photo; the file itself is left alone. */
    public function storeFile(string $file): string
    {
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($file) ?: '';
        if (! isset(Images::TYPES[$mime]) || ! @getimagesize($file) || filesize($file) > self::MAX_MB * 1024 * 1024) {
            $this->fail();
        }

        $image = $this->images->read($file);
        $image->cover(self::SIZE, self::SIZE);
        $path = 'parley/groups/'.bin2hex(random_bytes(16)).'.webp';
        $this->disk()->put($path, (string) $image->toWebp(85));

        return $path;
    }

    public function remove(?string $path): void
    {
        if ($path && preg_match(self::NAME, $path)) {
            $this->disk()->delete($path);
        }
    }

    public function url(?string $path): ?string
    {
        return $path && preg_match(self::NAME, $path) ? $this->disk()->url($path) : null;
    }

    /** @return never */
    private function fail(): void
    {
        throw new ValidationException(['photo' => $this->translator->trans('ernestdefoe-parley.api.group_photo_type', ['max' => self::MAX_MB])]);
    }

    private function disk(): Cloud
    {
        /** @var Cloud $disk */
        $disk = $this->filesystems->disk('flarum-assets');

        return $disk;
    }
}
