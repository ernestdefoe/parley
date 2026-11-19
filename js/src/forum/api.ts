import app from 'flarum/forum/app';
import type { FlarumRequestOptions } from 'flarum/common/Application';
import type {
  ConversationListResponse,
  ConversationResponse,
  DetailsResponse,
  GroupResponse,
  HeartbeatResponse,
  MessageResponse,
  MessagesResponse,
  OkResponse,
  PeopleResponse,
  PersonActionResponse,
  ReportsResponse,
  RoomsResponse,
  SearchResponse,
} from './types';

type Id = number | string;
type Extra<T> = Partial<FlarumRequestOptions<T>>;
type Params = Record<string, string | number | boolean | null | undefined>;

/** Every Parley call, in one place, so the URLs live in one file. */
const url = (path: string): string => app.forum.attribute('apiUrl') + '/parley' + path;

const call = <T>(method: string, path: string, body?: unknown, extra: Extra<T> = {}): Promise<T> =>
  app.request<T>({ method, url: url(path), body, ...extra });

/** A request whose failure the caller handles itself: no alert. */
const quietly = { errorHandler: () => {} };

const form = (fields: Record<string, string | Blob | null | undefined>): FormData => {
  const data = new FormData();
  Object.entries(fields).forEach(([k, v]) => v !== undefined && v !== null && data.append(k, v));
  return data;
};

const qs = (params: Params): string => {
  const q = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]): [string, string] => [k, String(v)])
  ).toString();
  return q ? '?' + q : '';
};

export default {
  rooms: (parent?: Id | null) =>
    call<RoomsResponse>('GET', '/rooms' + (parent ? `?parent=${parent}` : ''), undefined, { background: true, errorHandler: () => {} }),
  joinRoom: (id: Id) => call<RoomsResponse>('POST', `/rooms/${id}/join`),
  leaveRoom: (id: Id) => call<RoomsResponse>('POST', `/rooms/${id}/leave`),
  /** A page closing says goodbye; a beacon outlives the page. */
  leave() {
    const data = new FormData();
    data.append('csrfToken', app.session.csrfToken);
    navigator.sendBeacon?.(url('/leave'), data);
  },
  heartbeat: (body: object) => call<HeartbeatResponse>('POST', '/heartbeat', body, { background: true, errorHandler: () => {} }),
  conversations: (filter = 'all', offset = 0) => call<ConversationListResponse>('GET', '/conversations' + qs({ filter, offset: offset || null })),
  open: (userId: Id) => call<ConversationResponse>('POST', '/conversations', { userId }),
  show: (id: Id, params: Params = {}) => {
    // A poll is quiet: no loading bar, no error alert if one misses.
    const quiet = params.after || params.latest;
    return call<ConversationResponse>(
      'GET',
      `/conversations/${id}` + qs(params),
      undefined,
      quiet ? { background: true, errorHandler: () => {} } : {}
    );
  },
  /** Sent through the queue, which retries a dropped connection itself. */
  send: (id: Id, body: string, replyToId: number | null, nonce: string) =>
    call<MessageResponse>('POST', `/conversations/${id}/messages`, { body, replyToId, nonce }, quietly),
  upload: (id: Id, file: Blob, kind: string, extra: Record<string, string | Blob | null | undefined> = {}, onprogress?: (fraction: number) => void) =>
    app.request<MessageResponse>({
      method: 'POST',
      url: url(`/conversations/${id}/files`),
      body: form({ file, kind, ...extra }),
      serialize: (raw: FormData) => raw,
      config: (xhr: XMLHttpRequest) => {
        if (onprogress && xhr.upload) xhr.upload.onprogress = (e) => e.lengthComputable && onprogress(e.loaded / e.total);
      },
      ...quietly,
    }),
  action: (id: Id, action: string, body: object = {}) =>
    call<OkResponse>('POST', `/conversations/${id}/${action}`, body, { background: true, errorHandler: () => {} }),
  settings: (id: Id, changes: object) => call<OkResponse>('POST', `/conversations/${id}/settings`, changes),
  accept: (id: Id) => call<OkResponse>('POST', `/conversations/${id}/accept`),
  details: (id: Id, tab?: string, before?: Id | null) =>
    call<DetailsResponse>('GET', `/conversations/${id}/details` + qs({ tab, before }), undefined, { background: true }),
  createGroup: (userIds: Id[], name?: string | null) => call<ConversationResponse>('POST', '/groups', { userIds, name }),
  renameGroup: (id: Id, name: string | null) => call<GroupResponse>('PATCH', `/conversations/${id}`, { name }),
  groupPhoto: (id: Id, file: Blob | null) =>
    file
      ? app.request<GroupResponse>({
          method: 'POST',
          url: url(`/conversations/${id}/photo`),
          body: form({ photo: file }),
          serialize: (raw: FormData) => raw,
        })
      : call<GroupResponse>('DELETE', `/conversations/${id}/photo`),
  addMembers: (id: Id, userIds: Id[]) => call<GroupResponse>('POST', `/conversations/${id}/members`, { userIds }),
  removeMember: (id: Id, userId: Id) => call<GroupResponse>('DELETE', `/conversations/${id}/members/${userId}`),
  edit: (messageId: Id, body: string) => call<MessageResponse>('PATCH', `/messages/${messageId}`, { body }),
  remove: (messageId: Id) => call<MessageResponse>('DELETE', `/messages/${messageId}`),
  react: (messageId: Id, emoji: string) => call<MessageResponse>('POST', `/messages/${messageId}/react`, { emoji }),
  pin: (messageId: Id, on: boolean) => call<MessageResponse>('POST', `/messages/${messageId}/pin`, { on }),
  forward: (messageId: Id, conversationIds: Id[]) => call<MessagesResponse>('POST', `/messages/${messageId}/forward`, { conversationIds }),
  report: (messageId: Id, reason: string | null) => call<OkResponse>('POST', `/messages/${messageId}/report`, { reason }),
  search: (params: Params) => call<SearchResponse>('GET', '/search' + qs(params), undefined, { background: true }),
  people: (q: string) => call<PeopleResponse>('GET', '/people?q=' + encodeURIComponent(q), undefined, { background: true }),
  person: (userId: Id, action: string, on: boolean) => call<PersonActionResponse>('POST', `/people/${userId}/${action}`, { on }),
  reports: () => call<ReportsResponse>('GET', '/reports'),
  resolve: (id: Id) => call<ReportsResponse>('POST', `/reports/${id}/resolve`),
  fileUrl: (messageId: Id) => url(`/files/${messageId}`),
};
