<?php

namespace Ernestdefoe\Parley;

use Flarum\Foundation\Paths;
use Flarum\Foundation\ValidationException;
use Flarum\Locale\TranslatorInterface;
use Flarum\Settings\SettingsRepositoryInterface;
use Illuminate\Contracts\Container\Container;
use Intervention\Image\ImageManager;
use Psr\Http\Message\UploadedFileInterface;

/**
 * Pictures, voice notes, videos and files sent in a conversation.
 *
 * Stored under storage/, outside the web root, and only ever served through
 * FileController after it checks the viewer may read the conversation. A
 * conversation is private; what is sent in it is too, not merely unlisted.
 *
 * 🚨 The type is read from the bytes, never from the name or the browser's
 * claim, and only the types below are kept. Nothing that a browser would run
 * — HTML, SVG, XML, scripts — is on any list, so it is refused whatever it
 * calls itself, and FileController serves the rest with nosniff and a
 * sandboxing policy on top.
 */
class Images
{
    /** Pictures shown in the chat. */
    public const TYPES = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/gif' => 'gif',
        'image/webp' => 'webp',
    ];

    /** Videos played in the chat. */
    public const VIDEO = [
        'video/mp4' => 'mp4',
        'video/webm' => 'webm',
        'video/quicktime' => 'mov',
    ];

    /**
     * Voice notes. A browser records Opus in WebM (Chrome, Firefox) or AAC in
     * MP4 (Safari), and an audio-only file of either sniffs as video/* as
     * often as audio/*, so both are accepted and served as audio.
     */
    public const VOICE = [
        'audio/webm' => 'weba',
        'video/webm' => 'weba',
        'audio/ogg' => 'ogg',
        'audio/mp4' => 'm4a',
        'audio/x-m4a' => 'm4a',
        'video/mp4' => 'm4a',
        'audio/mpeg' => 'mp3',
        'audio/aac' => 'aac',
    ];

    /** Files offered as a download, never opened in the page. */
    public const FILES = [
        'application/pdf' => 'pdf',
        'application/zip' => 'zip',
        'application/x-7z-compressed' => '7z',
        'application/gzip' => 'gz',
        'application/x-rar' => 'rar',
        'application/vnd.rar' => 'rar',
        'text/plain' => 'txt',
        'text/csv' => 'csv',
        'application/msword' => 'doc',
        'application/vnd.ms-excel' => 'xls',
        'application/vnd.ms-powerpoint' => 'ppt',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' => 'xlsx',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation' => 'pptx',
        'application/vnd.oasis.opendocument.text' => 'odt',
        'application/vnd.oasis.opendocument.spreadsheet' => 'ods',
        'application/vnd.oasis.opendocument.presentation' => 'odp',
        'audio/mpeg' => 'mp3',
    ];

    /** The served type of each stored extension. */
    public const SERVE_AS = [
        'jpg' => 'image/jpeg', 'png' => 'image/png', 'gif' => 'image/gif', 'webp' => 'image/webp',
        'mp4' => 'video/mp4', 'webm' => 'video/webm', 'mov' => 'video/quicktime',
        'weba' => 'audio/webm', 'ogg' => 'audio/ogg', 'm4a' => 'audio/mp4', 'mp3' => 'audio/mpeg', 'aac' => 'audio/aac',
        'pdf' => 'application/pdf', 'zip' => 'application/zip', '7z' => 'application/x-7z-compressed',
        'gz' => 'application/gzip', 'rar' => 'application/vnd.rar', 'txt' => 'text/plain; charset=utf-8',
        'csv' => 'text/csv; charset=utf-8', 'doc' => 'application/msword', 'xls' => 'application/vnd.ms-excel',
        'ppt' => 'application/vnd.ms-powerpoint',
        'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'pptx' => 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'odt' => 'application/vnd.oasis.opendocument.text', 'ods' => 'application/vnd.oasis.opendocument.spreadsheet',
        'odp' => 'application/vnd.oasis.opendocument.presentation',
    ];

    /** A voice note this size is about ten minutes of Opus: the length cap is the real limit. */
    public const VOICE_MAX_MB = 6;

    /** The shape of every name store() gives a file: yyyy/mm/<hex>.<ext>. */
    private const NAME = '~^\d{4}/\d{2}/[a-f0-9]{32}\.(jpg|png|gif|webp|mp4|webm|mov|weba|ogg|m4a|mp3|aac|pdf|zip|7z|gz|rar|txt|csv|docx?|xlsx?|pptx?|odt|ods|odp)$~D';

    public function __construct(
        protected Paths $paths,
        protected SettingsRepositoryInterface $settings,
        protected TranslatorInterface $translator,
        protected ImageManager $manager
    ) {
    }

    /**
     * Keep an upload as a picture: the original endpoint, kept for clients
     * that still post to it.
     *
     * @return array{file: string, mime: string, w: int, h: int, size: int}
     */
    public function store(UploadedFileInterface $upload): array
    {
        $kept = $this->keep($upload, 'image');
        unset($kept['type'], $kept['name']);

        return $kept;
    }

    /**
     * Keep an upload of the kind the sender chose. A "file" that turns out to
     * be a picture or a video is kept as one, so it shows in the chat.
     *
     * @return array<string, mixed> the message meta, with `type` set to the message type
     */
    public function keep(UploadedFileInterface $upload, string $kind, ?float $seconds = null): array
    {
        if ($upload->getError() !== UPLOAD_ERR_OK) {
            $this->fail('upload_failed');
        }

        $maxMb = $this->maxMb($kind);
        if ($upload->getSize() > $maxMb * 1024 * 1024) {
            $this->fail($kind === 'image' ? 'image_too_big' : 'file_too_big', ['max' => $maxMb]);
        }

        if ($kind === 'voice') {
            $maxSeconds = $this->maxVoiceSeconds();
            if ($seconds === null || $seconds <= 0 || $seconds > $maxSeconds + 1) {
                $this->fail('voice_too_long', ['max' => (int) ceil($maxSeconds / 60)]);
            }
        }

        $tmp = tempnam(sys_get_temp_dir(), 'parley');
        $upload->moveTo($tmp);
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($tmp) ?: '';

        [$type, $ext] = $this->classify($kind, $mime);

        $meta = ['file' => '', 'mime' => self::SERVE_AS[$ext] ?? $mime, 'size' => 0];

        if ($type === 'image') {
            $size = @getimagesize($tmp);
            if (! $size) {
                @unlink($tmp);
                $this->fail('not_an_image');
            }
            $size = $this->stripMetadata($tmp, $ext) ?? $size;
            $meta += ['w' => (int) $size[0], 'h' => (int) $size[1]];
        }

        if ($type === 'voice') {
            $meta['duration'] = round(min((float) $seconds, $this->maxVoiceSeconds()), 1);
        }

        if ($type === 'file' || $type === 'video') {
            $meta['name'] = $this->cleanName((string) $upload->getClientFilename(), $ext);
        }

        $relative = date('Y/m').'/'.bin2hex(random_bytes(16)).'.'.$ext;
        $target = $this->root().'/'.$relative;

        if (! is_dir(dirname($target))) {
            mkdir(dirname($target), 0775, true);
        }

        rename($tmp, $target);
        @chmod($target, 0664);

        $meta['file'] = $relative;
        $meta['size'] = (int) filesize($target);
        $meta['type'] = $type;

        return $meta;
    }

    /**
     * 🚨 A phone's photo carries where it was taken. Re-encoding the picture
     * keeps what it shows (turned the right way up) and drops everything
     * else, so a conversation never hands out someone's location. A GIF is
     * left as it is: re-encoding would stop it moving, and GIFs carry no
     * camera data.
     *
     * @return array{0: int, 1: int}|null the new size, or null when left alone
     */
    private function stripMetadata(string $file, string $ext): ?array
    {
        if ($ext === 'gif') {
            return null;
        }

        try {
            $image = $this->manager->read($file);
            $encoded = match ($ext) {
                'png' => $image->toPng(),
                'webp' => $image->toWebp(90),
                default => $image->toJpeg(90),
            };
            file_put_contents($file, (string) $encoded);
        } catch (\Throwable) {
            @unlink($file);
            $this->fail('not_an_image');
        }

        return [$image->width(), $image->height()];
    }

    /**
     * What a sniffed type is kept as, or a refusal.
     *
     * @return array{0: string, 1: string} [message type, stored extension]
     */
    private function classify(string $kind, string $mime): array
    {
        if ($kind === 'voice') {
            isset(self::VOICE[$mime]) || $this->fail('not_audio');

            return ['voice', self::VOICE[$mime]];
        }

        if (isset(self::TYPES[$mime])) {
            return ['image', self::TYPES[$mime]];
        }

        if ($kind === 'image') {
            $this->fail('not_an_image');
        }

        if (isset(self::VIDEO[$mime])) {
            return ['video', self::VIDEO[$mime]];
        }

        if ($kind === 'file' && isset(self::FILES[$mime])) {
            return ['file', self::FILES[$mime]];
        }

        $this->fail($kind === 'video' ? 'not_a_video' : 'file_type');
    }

    /** A file's name as shown and downloaded: no path, no control characters, its real extension. */
    private function cleanName(string $name, string $ext): string
    {
        $name = preg_replace('/[\x00-\x1F\x7F\/\\\\:*?"<>|]+/u', '', basename(str_replace('\\', '/', $name))) ?? '';
        $base = trim((string) preg_replace('/\.[^.]*$/', '', $name)) ?: 'file';

        return mb_substr($base, 0, 100).'.'.$ext;
    }

    public function maxMb(string $kind): int
    {
        return match ($kind) {
            'image' => max(1, (int) ($this->settings->get('ernestdefoe-parley.max_image_mb') ?: 8)),
            'voice' => self::VOICE_MAX_MB,
            default => max(1, (int) ($this->settings->get('ernestdefoe-parley.max_file_mb') ?: 25)),
        };
    }

    public function maxVoiceSeconds(): int
    {
        return max(10, (int) ($this->settings->get('ernestdefoe-parley.max_voice_seconds') ?: 300));
    }

    public function path(string $relative): ?string
    {
        // A stored name is always yyyy/mm/<hex>.<ext>; anything else is not ours.
        if (! preg_match(self::NAME, $relative)) {
            return null;
        }

        $path = $this->root().'/'.$relative;

        return is_file($path) ? $path : null;
    }

    /** The type a stored file is served as, from its extension: never from what was sent. */
    public function servedType(string $relative): string
    {
        return self::SERVE_AS[strtolower(pathinfo($relative, PATHINFO_EXTENSION))] ?? 'application/octet-stream';
    }

    /**
     * Purging the extension deletes every file sent in a conversation.
     * Called by the messages table's down(), so disabling alone keeps them.
     *
     * Only names of the shape store() writes are deleted, then the folders
     * they leave empty; anything else under storage/parley stays.
     */
    public static function purge(Container $container): void
    {
        $root = $container->make(Paths::class)->storage.'/parley';

        foreach (glob("$root/[0-9][0-9][0-9][0-9]/[0-9][0-9]/*") ?: [] as $file) {
            if (preg_match(self::NAME, substr($file, strlen($root) + 1))) {
                @unlink($file);
            }
        }

        // rmdir refuses a folder that still holds something.
        foreach ([...glob("$root/[0-9][0-9][0-9][0-9]/[0-9][0-9]") ?: [], ...glob("$root/[0-9][0-9][0-9][0-9]") ?: [], $root] as $dir) {
            @rmdir($dir);
        }
    }

    private function root(): string
    {
        return $this->paths->storage.'/parley';
    }

    /** @return never */
    private function fail(string $key, array $params = []): void
    {
        throw new ValidationException(['file' => $this->translator->trans('ernestdefoe-parley.api.'.$key, $params)]);
    }
}
