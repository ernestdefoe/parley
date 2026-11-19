<?php

namespace Ernestdefoe\Parley;

/**
 * The one check every uploaded picture passes before anything decodes it:
 * sent pictures (Images), group photos (GroupPhotos) and room logos
 * (RoomImages).
 *
 * 🚨 The byte caps alone do not bound memory: an 8 MB PNG of 30 000 × 30 000
 * pixels needs about 3.6 GB to decode. getimagesizefromstring() reads only
 * the header, so the pixel count is known, and refused, before GD or
 * Intervention allocates anything.
 */
final class ImageBytes
{
    /** About 40 megapixels: more than any phone camera, about 160 MB to decode. */
    public const MAX_PIXELS = 40_000_000;

    /**
     * The width and height of a picture small enough to decode, or null for
     * anything that is not a picture or has too many pixels.
     *
     * @return array{0: int, 1: int}|null
     */
    public static function size(string $bytes): ?array
    {
        $size = @getimagesizefromstring($bytes);
        if (! $size || $size[0] < 1 || $size[1] < 1 || $size[0] * $size[1] > self::MAX_PIXELS) {
            return null;
        }

        return [(int) $size[0], (int) $size[1]];
    }

    /**
     * The same, for a picture of one of the types Parley shows (Images::TYPES),
     * read from the bytes: what a group photo or a room logo must be.
     *
     * @return array{0: int, 1: int}|null
     */
    public static function picture(string $bytes): ?array
    {
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->buffer($bytes) ?: '';

        return isset(Images::TYPES[$mime]) ? self::size($bytes) : null;
    }
}
