import app from 'flarum/forum/app';
import Notification from 'flarum/forum/components/Notification';
import type User from 'flarum/common/models/User';

/** What the notification's content carries. */
interface ConversationContent {
  conversationId?: number;
}

/** "BuckeyeBrian mentioned you in Game Day" — opens the room or the group. */
export default class RoomMentionNotification extends Notification {
  icon() {
    return 'fas fa-at';
  }

  href() {
    return app.route('parley.conversation', { id: this.attrs.notification.content<ConversationContent | null>()?.conversationId });
  }

  content() {
    const id = this.attrs.notification.content<ConversationContent | null>()?.conversationId;
    // A notification without an id finds no room or conversation, as before.
    const room = app.parley && app.parley.room(id as number);
    const conv = !room && app.parley && app.parley.conv(id as number);
    const username = (this.attrs.notification.fromUser() as User | null)?.displayName();

    // A room by its name; a group by its name when this page knows it.
    if (room) return app.translator.trans('ernestdefoe-parley.forum.notifications.room_mention', { username, room: room.name });
    if (conv && conv.summary.isGroup && conv.summary.title) {
      return app.translator.trans('ernestdefoe-parley.forum.notifications.room_mention', { username, room: conv.summary.title });
    }
    return app.translator.trans('ernestdefoe-parley.forum.notifications.mention_plain', { username });
  }

  excerpt() {
    return null;
  }
}
