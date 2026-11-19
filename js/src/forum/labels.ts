import app from 'flarum/forum/app';
import extractText from 'flarum/common/utils/extractText';
import type { ConversationSummary, Message } from './types';

/** What a one-line preview reads: a message, or a report's snapshot of one. */
type PreviewMessage = Pick<Message, 'type' | 'body'> & Partial<Pick<Message, 'deleted' | 'meta' | 'userId' | 'author'>>;

/*
 * How a conversation and a message read in a line of text: the list, the
 * heads, the window title, the forward picker and system rows all say it
 * the same way.
 */

const t = (key: string, params?: Record<string, unknown>): string =>
  extractText(params ? app.translator.trans('ernestdefoe-parley.forum.' + key, params) : app.translator.trans('ernestdefoe-parley.forum.' + key));

/** A group's own name, or its people's names; a room's name; the other person. */
/** What a conversation title needs: a full summary, or the room entries a picker builds itself. */
type Titled = Pick<ConversationSummary, 'type' | 'participants'> & Partial<Pick<ConversationSummary, 'room' | 'title' | 'isGroup' | 'memberCount'>>;

export function convTitle(summary: Titled | null | undefined): string {
  if (!summary) return '';
  if (summary.type === 'room') return (summary.room && summary.room.name) || summary.title || '';
  if (summary.isGroup) {
    if (summary.title) return summary.title;
    const names = (summary.participants || []).map((p) => p.displayName);
    const more = (summary.memberCount || names.length + 1) - 1 - names.length;
    return more > 0 ? t('group.names_more', { names: names.join(', '), count: more }) : names.join(', ') || t('group.untitled');
  }
  return ((summary.participants || [])[0] || {}).displayName || '?';
}

/** "Photo", "Voice message · 0:12", the words — what a message says in one line. */
export function messagePreview(msg: PreviewMessage | null | undefined): string {
  if (!msg) return '';
  if (msg.deleted) return t('window.deleted');
  switch (msg.type) {
    case 'image':
      return '📷 ' + t('window.photo');
    case 'video':
      return '🎬 ' + t('window.video');
    case 'voice':
      return '🎤 ' + t('window.voice_note', { length: duration((msg.meta || {}).duration) });
    case 'file':
      return '📎 ' + ((msg.meta || {}).name || t('window.file'));
    case 'call':
      return t('window.call_voice');
    case 'system':
      return systemLine(msg);
    default:
      return msg.body || '';
  }
}

/** "Ana added Ben and Cy" — a group's own news, from where the reader sits. */
export function systemLine(msg: PreviewMessage): string {
  const meta = msg.meta || {};
  const me = app.session.user && Number(app.session.user.id());
  const actor = msg.userId === me ? t('system.you') : (msg.author && msg.author.displayName) || '?';
  const names = (meta.userIds || []).map((id, i) => (id === me ? t('system.you_lower') : (meta.names || [])[i] || '?'));
  const list = names.length > 1 ? t('system.and', { first: names.slice(0, -1).join(', '), last: names[names.length - 1] }) : names[0] || '';

  switch (meta.action) {
    case 'created':
      return meta.name ? t('system.created_named', { actor, name: meta.name }) : t('system.created', { actor });
    case 'renamed':
      return meta.name ? t('system.renamed', { actor, name: meta.name }) : t('system.unnamed', { actor });
    case 'photo':
      return t('system.photo', { actor });
    case 'photo_removed':
      return t('system.photo_removed', { actor });
    case 'added':
      return t('system.added', { actor, names: list });
    case 'removed':
      return t('system.removed', { actor, names: list });
    case 'left':
      return t('system.left', { actor });
    case 'pinned':
      return t('system.pinned', { actor });
    default:
      return '';
  }
}

/** 0:07, 12:34 */
export function duration(seconds: unknown): string {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

/** 1.2 MB, 340 KB */
export function fileSize(bytes: unknown): string {
  const n = Number(bytes) || 0;
  if (n >= 1048576) return (n / 1048576).toFixed(n >= 10485760 ? 0 : 1) + ' MB';
  return Math.max(1, Math.round(n / 1024)) + ' KB';
}
