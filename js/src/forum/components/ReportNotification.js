import app from 'flarum/forum/app';
import Notification from 'flarum/forum/components/Notification';

/** For staff: a message was reported. Opens the queue. */
export default class ReportNotification extends Notification {
  icon() {
    return 'fas fa-flag';
  }

  href() {
    return app.route('parley.inbox');
  }

  content() {
    return app.translator.trans('ernestdefoe-parley.forum.notifications.report', {
      username: this.attrs.notification.subject()?.displayName?.(),
    });
  }

  excerpt() {
    return null;
  }
}
