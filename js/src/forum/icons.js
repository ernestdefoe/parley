import Icon from 'flarum/common/components/Icon';

/*
 * Parley's icons are the forum's own Font Awesome icons, drawn through
 * Flarum's Icon component: a theme or a Font Awesome kit that changes the
 * forum's icons changes these too. Same calls as before — `Icons.x()`.
 */
const icon = (name) => () => <Icon name={name} />;

export default {
  phone: icon('fas fa-phone'),
  video: icon('fas fa-video'),
  msg: icon('far fa-comment'),
  min: icon('fas fa-minus'),
  x: icon('fas fa-times'),
  send: icon('fas fa-paper-plane'),
  img: icon('far fa-image'),
  chev: icon('fas fa-chevron-down'),
  search: icon('fas fa-search'),
  goto: icon('fas fa-arrow-right'),
  more: icon('fas fa-ellipsis-h'),
  expand: icon('fas fa-expand-alt'),
  speaker: icon('fas fa-volume-up'),
  door: icon('fas fa-sign-out-alt'),
  people: icon('fas fa-user-friends'),
  plus: icon('fas fa-plus'),
  emoji: icon('far fa-smile'),
  mic: icon('fas fa-microphone'),
  stop: icon('fas fa-stop'),
  play: icon('fas fa-play'),
  pause: icon('fas fa-pause'),
  file: icon('far fa-file-alt'),
  forward: icon('fas fa-share'),
  reply: icon('fas fa-reply'),
  pin: icon('fas fa-thumbtack'),
  info: icon('fas fa-info-circle'),
  back: icon('fas fa-arrow-left'),
  star: icon('fas fa-star'),
  muted: icon('fas fa-bell-slash'),
  bell: icon('fas fa-bell'),
  archive: icon('fas fa-archive'),
  tag: icon('fas fa-tag'),
  edit: icon('fas fa-pencil-alt'),
  camera: icon('fas fa-camera'),
  newGroup: icon('fas fa-users'),
  compose: icon('fas fa-pen-to-square'),
  trash: icon('far fa-trash-alt'),
  ban: icon('fas fa-ban'),
  check: icon('fas fa-check'),
  link: icon('fas fa-link'),
  inbox: icon('fas fa-inbox'),
  at: icon('fas fa-at'),
};
