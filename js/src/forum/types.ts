/*
 * The shapes Parley's API sends, as the PHP payload builders make them:
 * People::card(), Rooms::card() and listFor(), OnlineList::for(),
 * Conversations::summaries() and payloads(). Types only — nothing here runs.
 */

import type Mithril from 'mithril';

/** A member's first visible group other than Members (People::badge()). */
export interface Badge {
  name: string;
  color: string | null;
  staff: boolean;
}

/** People::card(), plus what each endpoint adds beside it. */
export interface Person {
  id: number;
  username: string;
  displayName: string;
  slug: string;
  avatarUrl: string | null;
  badge: Badge | null;
  /** Conversation participants, people search, group members. */
  online?: boolean;
  /** A group member's role: owner or member. */
  role?: string;
  /** From the online list. */
  status?: string;
  activity?: Activity | null;
  following?: boolean;
  lastSeenAt?: string | null;
}

/** What someone on the online list is doing (OnlineList::activity()). */
export interface Activity {
  verb: string;
  label: string | null;
  idleMinutes?: number;
  roomId?: number;
  discussionId?: number;
  slug?: string;
  near?: number | null;
  tagSlug?: string;
}

/** Someone on the online list, or a followed member who is offline. */
export interface OnlinePerson extends Person {
  status: string;
  activity: Activity | null;
  following: boolean;
}

/** Rooms::card(). */
export interface RoomCard {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  emoji: string | null;
  imageUrl: string | null;
  imageDarkUrl: string | null;
  parentId: number | null;
  tagId: number | null;
  tagIcon: string | null;
  tagColor: string | null;
  readonly: boolean;
  position: number;
  archived: boolean;
  lastMessageAt: string | null;
}

/** A room in the rail (Rooms::listFor()): its card and the viewer's place in it. */
export interface Room extends RoomCard {
  children: number;
  childUnread: number;
  joined: boolean;
  unread: number;
  members: number;
  online: number;
}

export interface Reaction {
  userId: number;
  emoji: string;
}

/** The message a reply quotes. A pending one carries only id, excerpt and type. */
export interface ReplyRef {
  id: number;
  userId?: number | null;
  authorName?: string | null;
  excerpt: string | null;
  type: string;
}

/** A message's meta: a file's, a picture's, a call's or a group event's. */
export interface MessageMeta {
  [key: string]: unknown;
  name?: string;
  size?: number;
  mime?: string;
  w?: number;
  h?: number;
  duration?: number;
  durationSeconds?: number;
  forwarded?: boolean;
  /** A call's. */
  kind?: string;
  outcome?: string;
  callerId?: number;
  /** A group event's (type "system"). */
  action?: string;
  userIds?: number[];
  names?: string[];
}

/** Conversations::payloads(), and the greyed bubble of one still being sent. */
export interface Message {
  id: number;
  conversationId: number;
  userId: number | null;
  author?: Person | null;
  type: string;
  body: string | null;
  meta?: MessageMeta | null;
  replyTo: ReplyRef | null;
  reactions: Reaction[];
  createdAt: string;
  editedAt?: string | null;
  deleted?: boolean;
  pinned?: boolean;
  /** Our own send, echoed back so the pending copy can be replaced. */
  nonce?: string;
  /** Drawn while sending. */
  pending?: boolean;
  failed?: boolean;
  waiting?: boolean;
  error?: Mithril.Children | null;
}

/** Conversations::summaries(). */
export interface ConversationSummary {
  id: number;
  type: 'room' | 'direct';
  room: RoomCard | null;
  isGroup: boolean;
  title: string | null;
  imageUrl: string | null;
  participants: Person[];
  memberCount: number | null;
  role: string;
  lastMessage: Message | null;
  lastMessageAt: string | null;
  lastReadMessageId: number | null;
  /** Read receipts by user id. */
  seenBy: Record<string, number | null>;
  unread: number;
  muted: boolean;
  archived: boolean;
  starred: boolean;
  label: string | null;
  request: boolean;
  mentioned: boolean;
  pinCount: number;
}

/** What the state keeps per conversation. */
export interface ConvEntry {
  summary: ConversationSummary;
  messages: Message[];
  /** Whether the conversation itself has been fetched, not only its summary. */
  loaded: boolean;
  hasOlder: boolean;
  loadingOlder: boolean;
  /** userId → typing until (ms). */
  typing: Record<string, number>;
  /** Where "New messages" goes. */
  newFrom?: number;
  jumpTo?: number | null;
  gapAfter?: boolean;
  uploading?: { name: string; progress: number } | null;
  pins?: Message[] | null;
  loadingPins?: boolean;
}

/** What a translator (Rosetta) hands back for a message: the text to show and a line under it. */
export interface Translation {
  body: string;
  lang?: string;
  dir?: string;
  note?: Mithril.Children;
}

/** The forum's `parley` attribute (ForumResourceFields::config()). */
export interface ParleyConfig {
  canUse?: boolean;
  canModerate?: boolean;
  realtime?: boolean;
  awayMinutes?: number;
  maxImageMb?: number;
  maxFileMb?: number;
  maxVoiceSeconds?: number;
  groupMaxMembers?: number;
  reactions?: string[];
  labels?: string[];
}

/** Where the visitor is, in the heartbeat's terms (util placeFromPath(), state where()). */
export interface Place {
  place: string;
  discussionId?: number;
  near?: number | null;
  tagSlug?: string;
  tagId?: number | null;
  roomId?: number;
}

/** A message on its way, in the state's queue. */
export interface QueueItem {
  nonce: string;
  conversationId: number;
  body: string;
  replyToId: number | null;
  tries: number;
  state: 'sending' | 'waiting' | 'failed';
  timer?: ReturnType<typeof setTimeout>;
  error?: Mithril.Children | null;
}

/** A reported message's context, as the moderator sees it. */
export interface ReportSnapshotMessage {
  id: number;
  userId: number | null;
  type: string;
  body: string | null;
  createdAt: string;
  reported: boolean;
  user: Person | null;
}

export interface Report {
  id: number;
  reason: string | null;
  createdAt: string;
  reporter: Person | null;
  reported: Person | null;
  snapshot: ReportSnapshotMessage[];
}

// ── Responses ───────────────────────────────────────────────────────────────

export interface OkResponse {
  ok: boolean;
}

export interface HeartbeatResponse {
  ok?: boolean;
  online?: OnlinePerson[];
  followingOffline?: OnlinePerson[];
  more?: number;
  guests?: number;
  rooms?: Room[];
  unread?: Record<string, number>;
  requests?: number;
  quiet?: number[];
}

export interface RoomsResponse {
  rooms: Room[];
}

export interface ConversationListResponse {
  conversations: ConversationSummary[];
  hasMore: boolean;
}

export interface ConversationResponse {
  conversation: ConversationSummary;
  messages: Message[];
}

export interface MessageResponse {
  message: Message;
}

export interface MessagesResponse {
  messages: Message[];
}

/** A group change: the new summary and members, or `left` when you left it. */
export interface GroupResponse {
  ok?: boolean;
  left?: boolean;
  conversation: ConversationSummary;
  members?: Person[];
  messages?: Message[];
}

export interface DetailsResponse {
  members?: Person[];
  items?: Message[];
  hasMore?: boolean;
}

export interface SearchResponse {
  messages: Message[];
  conversations: ConversationSummary[];
  hasMore: boolean;
}

export interface PeopleResponse {
  people: Person[];
}

export interface PersonActionResponse {
  following: boolean;
  blocked: boolean;
}

export interface ReportsResponse {
  reports: Report[];
}
