import app from 'flarum/forum/app';
import extractText from 'flarum/common/utils/extractText';
import humanTime from 'flarum/common/utils/humanTime';

const t = (key, params) => app.translator.trans('ernestdefoe-parley.forum.activity.' + key, params);

/**
 * The line under a name in the online list: "Reading · <b>Ohio State at
 * Michigan</b>". The label is bold in the accent colour when it names a place
 * you can go, as in the mockup.
 */
export function activityLine(p) {
  const a = p.activity;

  if (p.status === 'offline') {
    return p.lastSeenAt ? t('last_seen', { ago: humanTime(p.lastSeenAt) }) : t('offline');
  }
  if (!a) return p.status === 'busy' ? [t('busy'), ' · ', t('dnd')] : t('online');

  switch (a.verb) {
    case 'reading':
      return [t('reading'), ' · ', <b>{a.label}</b>];
    case 'replying':
      return [t('replying'), ' · ', <b>{a.label}</b>];
    case 'browsing':
      return [t('browsing'), ' · ', <b>{a.label}</b>];
    case 'browsing_all':
      return [t('browsing'), ' · ', t('all_discussions')];
    case 'away':
      return [t('away'), ' · ', t('idle', { minutes: a.idleMinutes })];
    case 'busy':
      return [t('busy'), ' · ', t('dnd')];
    default:
      return t('online');
  }
}

/** The quieter line in a window header: "Reading · Ohio State…", "Active now". */
export function presenceLine(p) {
  const a = p.activity;
  if (p.status === 'offline') {
    return extractText(p.lastSeenAt ? t('last_seen', { ago: humanTime(p.lastSeenAt) }) : t('offline'));
  }
  if (p.status === 'away') return extractText(t('away')) + ' · ' + extractText(t('idle', { minutes: a?.idleMinutes || 1 }));
  if (p.status === 'busy') return extractText(t('busy')) + ' · ' + extractText(app.parley.callsInstalled ? t('calls_muted') : t('dnd'));
  if (a && (a.verb === 'reading' || a.verb === 'replying')) return extractText(t(a.verb)) + ' · ' + a.label;
  return extractText(t('active_now'));
}

/** Where "Go to" takes you, or null when there is nowhere to go. */
export function activityHref(p) {
  const a = p.activity;
  if (!a) return null;
  if (a.discussionId) {
    // The slug driver already leads with the id: `12-the-reading-room`.
    return app.route('discussion.near', { id: a.slug || a.discussionId, near: a.near || 1 });
  }
  if (a.tagSlug) return app.route('tag', { tags: a.tagSlug });
  return null;
}

/**
 * What you are doing yourself, worked out in this browser from where you are,
 * so your own row changes the moment you move. Same words others see for you,
 * with the place's name taken from what this page has already loaded.
 */
export function ownActivity() {
  const w = app.parley.where();
  if (w.place === 'discussion' || w.place === 'reply') {
    const d = w.discussionId && app.store.getById('discussions', String(w.discussionId));
    if (!d) return null;
    return { verb: w.place === 'reply' ? 'replying' : 'reading', label: d.title() };
  }
  if (w.place === 'tag' && w.tagId) {
    const tag = app.store.getById('tags', String(w.tagId));
    return tag ? { verb: 'browsing', label: tag.name() } : null;
  }
  if (w.place === 'index') return { verb: 'browsing_all', label: null };
  return null;
}
