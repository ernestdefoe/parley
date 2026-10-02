<?php
/*
 * FBSFB: a Parley room per team, under its conference's room, wearing the
 * team's ESPN logo (and ESPN's dark-mode logo). Conference rooms get ESPN's
 * dark logos too. Safe to run again: existing rooms and logos are kept.
 *
 *   php fbsfb-team-rooms.php [--create-conferences]
 *
 * Run from the forum root as www-data. Reads Game Day's team→tag map and
 * Pick'em's team logos, so both must be installed.
 */
$site = require getcwd().'/site.php';
$app = $site->bootApp();
$db = resolve(Illuminate\Database\ConnectionInterface::class);
$rooms = resolve(Ernestdefoe\Parley\Rooms::class);
$images = resolve(Ernestdefoe\Parley\RoomImages::class);
$createConferences = in_array('--create-conferences', $argv, true);

// ESPN's conference ids, by FBSFB's conference tag names.
$espnConf = ['SEC' => 8, 'ACC' => 1, 'B1G' => 5, 'Big 12' => 4, 'AAC' => 151, 'CUSA' => 12, 'MAC' => 15,
    'Mountain West' => 17, 'Sun Belt' => 37, 'Independents' => 18, 'Pac 12' => 9];

/** Download to a temp file; null unless it is really a PNG of some size. */
$fetch = function (string $url): ?string {
    $ctx = stream_context_create(['http' => ['header' => "User-Agent: curl/8.7.1\r\n", 'timeout' => 20, 'ignore_errors' => true]]);
    $data = @file_get_contents($url, false, $ctx);
    if (! $data || strlen($data) < 500 || substr($data, 0, 8) !== "\x89PNG\r\n\x1a\n") {
        return null;
    }
    $tmp = tempnam(sys_get_temp_dir(), 'logo');
    file_put_contents($tmp, $data);

    return $tmp;
};
$fresh = fn (int $id) => $db->table('parley_conversations')->find($id);

$conferenceTags = $db->table('tags')->whereNull('parent_id')->whereIn('name', array_keys($espnConf))->orderBy('position')->get();
$made = 0; $kept = 0; $logos = 0; $darks = 0; $missing = [];

foreach ($conferenceTags as $ctag) {
    $conf = $db->table('parley_conversations')->where('type', 'room')->where('tag_id', $ctag->id)->first();
    if (! $conf && $createConferences) {
        $conf = $rooms->save(null, ['name' => $ctag->name, 'tagId' => $ctag->id]);
        if ($f = $fetch("https://a.espncdn.com/i/teamlogos/ncaa_conf/500/{$espnConf[$ctag->name]}.png")) { $images->set($conf, $f); @unlink($f); }
    }
    if (! $conf) { echo "no room for conference {$ctag->name} — skipped\n"; continue; }

    // ESPN's own dark logo for the conference, where it publishes one.
    $confRow = $fresh((int) $conf->id);
    if ($confRow->image_path && (! $confRow->image_dark_path || str_contains($confRow->image_dark_path, '-dark-auto-'))) {
        if ($f = $fetch("https://a.espncdn.com/i/teamlogos/ncaa_conf/500-dark/{$espnConf[$ctag->name]}.png")) {
            $images->set($confRow, $f, 'dark'); @unlink($f); $darks++;
        } elseif (! $confRow->image_dark_path) {
            // ESPN has none (CUSA, Sun Belt): store the room's own logo again,
            // which makes a dark version from it when it needs one.
            $own = getcwd().'/public/assets/'.$confRow->image_path;
            if (is_file($own)) {
                $copy = tempnam(sys_get_temp_dir(), 'logo');
                copy($own, $copy);
                $images->set($confRow, $copy);
                @unlink($copy);
            }
        }
    }

    $teamTags = $db->table('tags')->where('parent_id', $ctag->id)->orderBy('position')->orderBy('name')->get();
    foreach ($teamTags as $ttag) {
        $room = $db->table('parley_conversations')->where('type', 'room')->where('tag_id', $ttag->id)->first();
        if ($room) {
            $kept++;
        } else {
            $room = $rooms->save(null, ['name' => $ttag->name, 'tagId' => $ttag->id, 'parentId' => $conf->id]);
            $made++;
        }
        $room = $fresh((int) $room->id);
        if ($room->image_path) { continue; }

        $team = $db->table('gameday_team_tags as g')->join('picks_teams as p', 'p.id', '=', 'g.team_id')
            ->where('g.tag_id', $ttag->id)->first(['p.logo_path', 'p.logo_dark_path', 'p.espn_id']);
        // No Game Day link for this tag: match the Pick'em team by its name.
        $team ??= $db->table('picks_teams')->where('name', $ttag->name)->first(['logo_path', 'logo_dark_path', 'espn_id']);
        $light = $team ? ($team->logo_path ?: ($team->espn_id ? "https://a.espncdn.com/i/teamlogos/ncaa/500/{$team->espn_id}.png" : null)) : null;
        $dark = $team ? ($team->logo_dark_path ?: ($team->espn_id ? "https://a.espncdn.com/i/teamlogos/ncaa/500-dark/{$team->espn_id}.png" : null)) : null;

        if (! $light || ! str_starts_with($light, 'http') || ! ($f = $fetch($light))) { $missing[] = $ttag->name; continue; }
        $images->set($room, $f); @unlink($f); $logos++;
        if ($dark && str_starts_with($dark, 'http') && ($f = $fetch($dark))) { $images->set($fresh((int) $room->id), $f, 'dark'); @unlink($f); $darks++; }
    }
}

echo "team rooms created: $made, already there: $kept\n";
echo "team logos: $logos, dark logos from ESPN: $darks\n";
echo $missing ? 'no logo found for: '.implode(', ', $missing)."\n" : "every team has a logo\n";
