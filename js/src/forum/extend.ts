import Extend from 'flarum/common/extenders';
import MessageNotification from './components/MessageNotification';
import ReportNotification from './components/ReportNotification';
import RoomMentionNotification from './components/RoomMentionNotification';

/*
 * 🚨 Not /messages: flarum/messages owns it, and two routes on one path stop
 * the whole forum booting. Not /chat either, which ramon/chat holds while
 * both are installed during a switch-over.
 *
 * The messenger loads when someone first goes there, never with other pages.
 */
const InboxPage = () => import('./components/InboxPage');

export default [
  new Extend.Routes().add('parley.inbox', '/parley', InboxPage).add('parley.conversation', '/parley/:id', InboxPage),

  new Extend.Notification()
    .add('parleyMessage', MessageNotification)
    .add('parleyReport', ReportNotification)
    .add('parleyRoomMention', RoomMentionNotification),
];
