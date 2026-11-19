<?php

namespace Ernestdefoe\Parley;

use Flarum\Foundation\Paths;
use Flarum\Foundation\ValidationException;
use Flarum\Locale\TranslatorInterface;
use Flarum\Settings\SettingsRepositoryInterface;
use Illuminate\Contracts\Container\Container;
use Illuminate\Contracts\Filesystem\Factory;
use Illuminate\Contracts\Filesystem\Filesystem;
use Intervention\Image\ImageManager;
use Psr\Http\Message\UploadedFileInterface;

/**
 * Pictures, voice notes, videos and files sent in a conversation.
 *
 * Stored on Parley's own disk (DISK: storage/parley, outside the web root,
 * unless the forum points it at another driver), and only ever served through
 * ImageController after it checks the viewer may read the conversation. A
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

    /** The private disk everything sent in a conversation is kept on (see UploadsDisk). */
    public const DISK = 'ernestdefoe-parley';

    public function __construct(
        protected Factory $filesystems,
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

        // Read into memory: the caps above keep it to tens of megabytes, and
        // the bytes go straight to the disk, whatever driver it uses.
        $bytes = (string) $upload->getStream();
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->buffer($bytes) ?: '';

        [$type, $ext] = $this->classify($kind, $mime);

        $meta = ['file' => '', 'mime' => self::SERVE_AS[$ext] ?? $mime, 'size' => 0];

        if ($type === 'image') {
            $size = @getimagesizefromstring($bytes) ?: $this->fail('not_an_image');
            [$bytes, $size] = $this->stripMetadata($bytes, $ext) ?? [$bytes, $size];
            $meta += ['w' => (int) $size[0], 'h' => (int) $size[1]];
        }

        if ($type === 'voice') {
            $meta['duration'] = round(min((float) $seconds, $this->maxVoiceSeconds()), 1);
        }

        if ($type === 'file' || $type === 'video') {
            $meta['name'] = $this->cleanName((string) $upload->getClientFilename(), $ext);
        }

        $relative = date('Y/m').'/'.bin2hex(random_bytes(16)).'.'.$ext;
        $this->disk()->put($relative, $bytes);

        $meta['file'] = $relative;
        $meta['size'] = strlen($bytes);
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
     * @return array{0: string, 1: array{0: int, 1: int}}|null the new bytes and size, or null when left alone
     */
    private function stripMetadata(string $bytes, string $ext): ?array
    {
        if ($ext === 'gif') {
            return null;
        }

        try {
            $image = $this->manager->read($bytes);
            $encoded = match ($ext) {
                'png' => $image->toPng(),
                'webp' => $image->toWebp(90),
                default => $image->toJpeg(90),
            };
        } catch (\Intervention\Image\Exceptions\RuntimeException) {
            // Sniffed as a picture but not decodable: refused like any non-picture.
            $this->fail('not_an_image');
        }

        return [(string) $encoded, [$image->width(), $image->height()]];
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
            'image' => max(1, (int) $this->settings->get('ernestdefoe-parley.max_image_mb')),
            'voice' => self::VOICE_MAX_MB,
            default => max(1, (int) $this->settings->get('ernestdefoe-parley.max_file_mb')),
        };
    }

    public function maxVoiceSeconds(): int
    {
        return max(10, (int) $this->settings->get('ernestdefoe-parley.max_voice_seconds'));
    }

    /** A stored name, if it is one of ours and still on the disk. */
    public function stored(string $relative): ?string
    {
        // A stored name is always yyyy/mm/<hex>.<ext>; anything else is not ours.
        return preg_match(self::NAME, $relative) && $this->disk()->exists($relative) ? $relative : null;
    }

    /**
     * Delete a stored file. The caller decides it is no longer used: a
     * forwarded message shares its original's file.
     */
    public function remove(string $relative): void
    {
        if (preg_match(self::NAME, $relative)) {
            $this->disk()->delete($relative);
        }
    }

    public function disk(): Filesystem
    {
        return $this->filesystems->disk(self::DISK);
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
     * A purge runs with the extension disabled, when Parley's disk is no
     * longer declared, so storage/ is opened here and UploadsDisk says where
     * under it Parley's files are.
     * Only names of the shape keep() writes are deleted, then the folders
     * they leave empty; anything else under storage/parley stays.
     */
    public static function purge(Container $container): void
    {
        $paths = $container->make(Paths::class);
        $disk = $container->make(Factory::class)->build(['driver' => 'local', 'root' => $paths->storage]);
        $root = substr((new UploadsDisk())($paths)['root'], strlen($paths->storage) + 1);

        $disk->delete(array_filter($disk->allFiles($root), fn (string $f) => (bool) preg_match(self::NAME, substr($f, strlen($root) + 1))));

        // Deepest first, so a month empties before its year and the year before the root.
        foreach ([...array_reverse($disk->allDirectories($root)), $root] as $dir) {
            if ($disk->allFiles($dir) === []) {
                $disk->deleteDirectory($dir);
            }
        }
    }

    /** @return never */
    private function fail(string $key, array $params = []): void
    {
        throw new ValidationException(['file' => $this->translator->trans('ernestdefoe-parley.api.'.$key, $params)]);
    }
}
