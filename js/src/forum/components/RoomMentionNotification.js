import app from 'flarum/forum/app';
import Notification from 'flarum/forum/components/Notification';

/** "BuckeyeBrian mentioned you in Game Day" — opens the room. */
export default class RoomMentionNotification extends Notification {
  icon() {
    return 'fas fa-at';
  }

  href() {
    return app.route('parley.conversation', { id: this.attrs.notification.content()?.conversationId });
  }

  content() {
    const id = this.attrs.notification.content()?.conversationId;
    const room = app.parley && app.parley.room(id);
    return app.translator.trans(room ? 'ernestdefoe-parley.forum.notifications.room_mention' : 'ernestdefoe-parley.forum.notifications.room_mention_plain', {
      username: this.attrs.notification.fromUser()?.displayName(),
      room: room ? room.name : '',
    });
  }

  excerpt() {
    return null;
  }
}
