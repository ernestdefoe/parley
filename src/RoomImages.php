<?php

namespace Ernestdefoe\Parley;

use Flarum\Foundation\ValidationException;
use Flarum\Locale\TranslatorInterface;
use Illuminate\Contracts\Filesystem\Cloud;
use Illuminate\Contracts\Filesystem\Factory;
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

    /**
     * Store a logo for a room from a file on disk, replacing any before it.
     *
     * $variant 'light' is the logo itself. 'dark' is a version drawn for dark
     * backgrounds — ESPN publishes one for most teams. When there is no dark
     * version of its own, one is made from the light logo if, and only if, it
     * would not read on a dark tile (see needsOutline()).
     */
    public function set(object $room, string $file, string $variant = 'light'): string
    {
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($file) ?: '';
        if (! in_array($mime, self::TYPES, true) || ! @getimagesize($file)) {
            throw new ValidationException(['image' => $this->translator->trans('ernestdefoe-parley.api.room_image_type')]);
        }

        $img = $this->redraw($file);

        // A dark version is trusted as drawn, unless nothing in it stands out
        // from the dark tile — ESPN's dark Arkansas hog is dark red on dark.
        if ($variant === 'dark' && $this->needsOutline($img, true)) {
            $img = $this->outline($img);
        }

        $png = $this->png($img);
        $column = $variant === 'dark' ? 'image_dark_path' : 'image_path';
        $path = 'parley/rooms/'.$room->id.($variant === 'dark' ? '-dark-' : '-').substr(sha1($png), 0, 12).'.png';

        $this->disk()->put($path, $png);
        $this->forget($room, $column);
        $this->db->table('parley_conversations')->where('id', $room->id)->update([$column => $path]);

        // A new light logo remakes the made-up dark one; an uploaded dark one
        // is left alone.
        if ($variant === 'light' && ! $this->hasOwnDark($room)) {
            $this->forget($room, 'image_dark_path');
            if ($this->needsOutline($img, false)) {
                $dark = $this->outline($img);
                $darkPng = $this->png($dark);
                $darkPath = 'parley/rooms/'.$room->id.'-dark-auto-'.substr(sha1($darkPng), 0, 12).'.png';
                $this->disk()->put($darkPath, $darkPng);
                $this->db->table('parley_conversations')->where('id', $room->id)->update(['image_dark_path' => $darkPath]);
            }
        }

        return $path;
    }

    public function remove(object $room, string $variant = 'both'): void
    {
        if ($variant !== 'dark') {
            $this->forget($room, 'image_path');
        }
        if ($variant !== 'light') {
            $this->forget($room, 'image_dark_path');
        }
    }

    private function forget(object $room, string $column): void
    {
        $old = $this->db->table('parley_conversations')->where('id', $room->id)->value($column);
        if ($old) {
            $this->disk()->delete($old);
            $this->db->table('parley_conversations')->where('id', $room->id)->update([$column => null]);
        }
    }

    private function hasOwnDark(object $room): bool
    {
        $dark = (string) $this->db->table('parley_conversations')->where('id', $room->id)->value('image_dark_path');

        return $dark !== '' && ! str_contains($dark, '-dark-auto-');
    }

    /**
     * Would this logo be lost on Parley's dark tile?
     *
     * Two measures, against the tile colour (#1d222d):
     * - its brightest tenth: a logo with no bright part at all — no white, no
     *   light outline — has nothing to read by, however it is coloured;
     * - for a logo drawn for white backgrounds, also how much of it is truly
     *   dark: Sun Belt's navy lettering vanishes even though its gold sun shows.
     * A dark version supplied for dark mode is judged by the first only:
     * Georgia's black G reads because of its white edge, and must not get a
     * second one.
     */
    private function needsOutline(\GdImage $img, bool $madeForDark): bool
    {
        $size = imagesx($img);
        $contrasts = [];
        $tile = 0.0153; // #1d222d

        for ($y = 0; $y < $size; $y += 2) {
            for ($x = 0; $x < $size; $x += 2) {
                $c = imagecolorat($img, $x, $y);
                if ((($c >> 24) & 0x7F) > 64) {
                    continue;
                }
                $l = $this->luminance(($c >> 16) & 0xFF, ($c >> 8) & 0xFF, $c & 0xFF);
                $contrasts[] = ($l + 0.05) / ($tile + 0.05);
            }
        }

        if ($contrasts === []) {
            return false;
        }

        sort($contrasts);
        $brightest = $contrasts[(int) floor(count($contrasts) * 0.9)];
        if ($brightest < 4.5) {
            return true;
        }

        if ($madeForDark) {
            return false;
        }

        $dark = count(array_filter($contrasts, fn ($k) => $k < 1.5));

        return $dark / count($contrasts) >= 0.2;
    }

    /**
     * The logo with a thin light outline — its own shape, grown a few pixels,
     * filled light and laid underneath, the way a sticker has a white edge.
     */
    private function outline(\GdImage $img): \GdImage
    {
        $size = imagesx($img);

        // Outline: the logo's own shape, grown a few pixels, filled light and
        // laid underneath. Grown as a square in two passes (rows, then
        // columns), which is fast and looks the same at tile size.
        $r = (int) round($size * 0.022);
        $alpha = [];
        for ($y = 0; $y < $size; $y++) {
            for ($x = 0; $x < $size; $x++) {
                $alpha[$y][$x] = 127 - ((imagecolorat($img, $x, $y) >> 24) & 0x7F);
            }
        }
        $grow = function (array $a, bool $rows) use ($size, $r): array {
            $out = [];
            for ($y = 0; $y < $size; $y++) {
                for ($x = 0; $x < $size; $x++) {
                    $m = 0;
                    for ($k = -$r; $k <= $r; $k++) {
                        $v = $rows ? ($a[$y][$x + $k] ?? 0) : ($a[$y + $k][$x] ?? 0);
                        if ($v > $m) {
                            $m = $v;
                        }
                    }
                    $out[$y][$x] = $m;
                }
            }

            return $out;
        };
        $mask = $grow($grow($alpha, true), false);

        $out = imagecreatetruecolor($size, $size);
        imagealphablending($out, false);
        imagesavealpha($out, true);
        for ($y = 0; $y < $size; $y++) {
            for ($x = 0; $x < $size; $x++) {
                // #e7eaf0, Parley's own light ink, not pure white.
                imagesetpixel($out, $x, $y, imagecolorallocatealpha($out, 0xE7, 0xEA, 0xF0, 127 - $mask[$y][$x]));
            }
        }
        imagealphablending($out, true);
        imagecopy($out, $img, 0, 0, 0, 0, $size, $size);

        return $out;
    }

    private function luminance(int $r, int $g, int $b): float
    {
        $lin = fn (int $v) => ($c = $v / 255) <= 0.03928 ? $c / 12.92 : (($c + 0.055) / 1.055) ** 2.4;

        return 0.2126 * $lin($r) + 0.7152 * $lin($g) + 0.0722 * $lin($b);
    }

    private function png(\GdImage $img): string
    {
        ob_start();
        imagesavealpha($img, true);
        imagepng($img, null, 9);

        return (string) ob_get_clean();
    }

    private function redraw(string $file): \GdImage
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
        imagealphablending($out, false);
        imagesavealpha($out, true);

        return $out;
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
        $minX = $w;
        $minY = $h;
        $maxX = -1;
        $maxY = -1;
        for ($y = 0; $y < $h; $y += $step) {
            for ($x = 0; $x < $w; $x += $step) {
                if (! $empty(imagecolorat($img, $x, $y))) {
                    $minX = min($minX, $x);
                    $maxX = max($maxX, $x);
                    $minY = min($minY, $y);
                    $maxY = max($maxY, $y);
                }
            }
        }

        if ($maxX < 0) {
            return [0, 0, $w, $h];
        }

        return [$minX, $minY, min($w - $minX, $maxX - $minX + $step), min($h - $minY, $maxY - $minY + $step)];
    }

    private function disk(): Cloud
    {
        return $this->filesystems->disk('flarum-assets');
    }
}
