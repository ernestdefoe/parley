/*
 * What a conversation window draws inside it: the messages and the composer.
 * One chunk, loaded when the first window or the messages page opens, so a
 * page with only chat heads on it carries none of it.
 */
import MessageList from './MessageList';
import Composer from './Composer';

export { MessageList, Composer };
