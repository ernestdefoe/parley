import app from 'flarum/forum/app';
import Notification from 'flarum/forum/components/Notification';

/** "BuckeyeBrian sent you a message" — opens the conversation. */
export default class MessageNotification extends Notification {
  icon() {
    return 'fas fa-comment';
  }

  href() {
    const id = this.attrs.notification.content()?.conversationId;
    return app.route('parley.conversation', { id });
  }

  content() {
    return app.translator.trans('ernestdefoe-parley.forum.notifications.message', {
      username: this.attrs.notification.fromUser()?.displayName(),
    });
  }

  excerpt() {
    return null;
  }
}
