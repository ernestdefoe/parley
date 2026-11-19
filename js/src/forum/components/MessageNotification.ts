import app from 'flarum/forum/app';
import Notification from 'flarum/forum/components/Notification';
import type User from 'flarum/common/models/User';

/** What the notification's content carries. */
interface ConversationContent {
  conversationId?: number;
}

/** "BuckeyeBrian sent you a message" — opens the conversation. */
export default class MessageNotification extends Notification {
  icon() {
    return 'fas fa-comment';
  }

  href() {
    const id = this.attrs.notification.content<ConversationContent | null>()?.conversationId;
    return app.route('parley.conversation', { id });
  }

  content() {
    return app.translator.trans('ernestdefoe-parley.forum.notifications.message', {
      username: (this.attrs.notification.fromUser() as User | null)?.displayName(),
    });
  }

  excerpt() {
    return null;
  }
}
