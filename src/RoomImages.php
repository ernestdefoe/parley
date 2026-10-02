<?php

namespace Ernestdefoe\Parley;

use Flarum\Foundation\ValidationException;
use Flarum\Locale\TranslatorInterface;
use Illuminate\Contracts\Filesystem\Factory;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Database\ConnectionInterface;

/**
 * A room's logo: uploaded once, stored on the forum, never hotlinked.
 *
 * Every upload is redrawn: the transparent margin is trimmed, the logo is
 * centred on a square with a small border of its own, and saved as a 256px
 * PNG. A conference logo published as a thin strip in a big empty square
 * then fills a 36px tile instead of shrinking to a smudge.
 *
 * SVG is refused: an SVG can carry script, and these are served from the
 * forum's own domain.
 */
class RoomImages
{
    public const SIZE = 256;

    /** How much of the square the logo fills, at most. */
    private const FILL = 0.86;

    private const TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

    public function __construct(
        protected Factory $filesystems,
        protected ConnectionInterface $db,
        protected TranslatorInterface $translator
    ) {
    }

    public function url(?string $path): ?string
    {
        return $path ? $this->disk()->url($path) : null;
    }

    /** Store a logo for a room from a file on disk, replacing any before it. */
    public function set(object $room, string $file): string
    {
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($file) ?: '';
        if (! in_array($mime, self::TYPES, true) || ! @getimagesize($file)) {
            throw new ValidationException(['image' => $this->translator->trans('ernestdefoe-parley.api.room_image_type')]);
        }

        $png = $this->redraw($file);
        $path = 'parley/rooms/'.$room->id.'-'.substr(sha1($png), 0, 12).'.png';

        $this->disk()->put($path, $png);
        $this->remove($room);

        $this->db->table('parley_conversations')->where('id', $room->id)->update(['image_path' => $path]);

        return $path;
    }

    public function remove(object $room): void
    {
        $old = $this->db->table('parley_conversations')->where('id', $room->id)->value('image_path');
        if ($old) {
            $this->disk()->delete($old);
            $this->db->table('parley_conversations')->where('id', $room->id)->update(['image_path' => null]);
        }
    }

    private function redraw(string $file): string
    {
        $src = @imagecreatefromstring((string) file_get_contents($file));
        if (! $src) {
            throw new ValidationException(['image' => $this->translator->trans('ernestdefoe-parley.api.room_image_type')]);
        }

        imagepalettetotruecolor($src);
        imagealphablending($src, false);
        imagesavealpha($src, true);

        [$x, $y, $w, $h] = $this->contentBox($src);

        $out = imagecreatetruecolor(self::SIZE, self::SIZE);
        imagealphablending($out, false);
        imagesavealpha($out, true);
        imagefill($out, 0, 0, imagecolorallocatealpha($out, 0, 0, 0, 127));
        imagealphablending($out, true);

        $scale = (self::SIZE * self::FILL) / max($w, $h);
        $dw = max(1, (int) round($w * $scale));
        $dh = max(1, (int) round($h * $scale));
        imagecopyresampled($out, $src, (int) ((self::SIZE - $dw) / 2), (int) ((self::SIZE - $dh) / 2), $x, $y, $dw, $dh, $w, $h);

        ob_start();
        imagesavealpha($out, true);
        imagepng($out, null, 9);

        return (string) ob_get_clean();
    }

    /**
     * The smallest box holding everything that is not transparent (or, for a
     * picture with no transparency, everything that is not its corner colour).
     *
     * @return array{int, int, int, int} x, y, width, height
     */
    private function contentBox(\GdImage $img): array
    {
        $w = imagesx($img);
        $h = imagesy($img);
        $corner = imagecolorat($img, 0, 0);
        $cornerAlpha = ($corner >> 24) & 0x7F;
        $empty = fn (int $c) => $cornerAlpha >= 120
            ? (($c >> 24) & 0x7F) >= 120
            : abs((($c >> 16) & 0xFF) - (($corner >> 16) & 0xFF)) + abs((($c >> 8) & 0xFF) - (($corner >> 8) & 0xFF)) + abs(($c & 0xFF) - ($corner & 0xFF)) < 24;

        $step = max(1, (int) floor(max($w, $h) / 500));
        $minX = $w; $minY = $h; $maxX = -1; $maxY = -1;
        for ($y = 0; $y < $h; $y += $step) {
            for ($x = 0; $x < $w; $x += $step) {
                if (! $empty(imagecolorat($img, $x, $y))) {
                    $minX = min($minX, $x); $maxX = max($maxX, $x);
                    $minY = min($minY, $y); $maxY = max($maxY, $y);
                }
            }
        }

        if ($maxX < 0) {
            return [0, 0, $w, $h];
        }

        return [$minX, $minY, min($w - $minX, $maxX - $minX + $step), min($h - $minY, $maxY - $minY + $step)];
    }

    private function disk(): Filesystem
    {
        return $this->filesystems->disk('flarum-assets');
    }
}
