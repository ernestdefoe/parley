import type ParleyState from '../src/forum/state';

declare module 'flarum/forum/ForumApplication' {
  export default interface ForumApplication {
    /** Set at mount for members who may use Parley, before any Parley component draws. */
    parley: ParleyState;
  }
}
