import app from 'flarum/forum/app';

/** Every Parley call, in one place, so the URLs live in one file. */
const url = (path) => app.forum.attribute('apiUrl') + '/parley' + path;

const call = (method, path, body, extra = {}) => app.request({ method, url: url(path), body, ...extra });

/** A request whose failure the caller handles itself: no alert. */
const quietly = { errorHandler: () => {} };

const form = (fields) => {
  const data = new FormData();
  Object.entries(fields).forEach(([k, v]) => v !== undefined && v !== null && data.append(k, v));
  return data;
};

const qs = (params) => {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString();
  return q ? '?' + q : '';
};

export default {
  rooms: (parent) => call('GET', '/rooms' + (parent ? `?parent=${parent}` : ''), undefined, { background: true, errorHandler: () => {} }),
  joinRoom: (id) => call('POST', `/rooms/${id}/join`),
  leaveRoom: (id) => call('POST', `/rooms/${id}/leave`),
  /** A page closing says goodbye; a beacon outlives the page. */
  leave() {
    const data = new FormData();
    data.append('csrfToken', app.session.csrfToken);
    navigator.sendBeacon?.(url('/leave'), data);
  },
  heartbeat: (body) => call('POST', '/heartbeat', body, { background: true, errorHandler: () => {} }),
  conversations: (filter = 'all', offset = 0) => call('GET', '/conversations' + qs({ filter, offset: offset || null })),
  open: (userId) => call('POST', '/conversations', { userId }),
  show: (id, params = {}) => {
    // A poll is quiet: no loading bar, no error alert if one misses.
    const quiet = params.after || params.latest;
    return call('GET', `/conversations/${id}` + qs(params), undefined, quiet ? { background: true, errorHandler: () => {} } : {});
  },
  /** Sent through the queue, which retries a dropped connection itself. */
  send: (id, body, replyToId, nonce) => call('POST', `/conversations/${id}/messages`, { body, replyToId, nonce }, quietly),
  upload: (id, file, kind, extra = {}, onprogress) =>
    app.request({
      method: 'POST',
      url: url(`/conversations/${id}/files`),
      body: form({ file, kind, ...extra }),
      serialize: (raw) => raw,
      config: (xhr) => {
        if (onprogress && xhr.upload) xhr.upload.onprogress = (e) => e.lengthComputable && onprogress(e.loaded / e.total);
      },
      ...quietly,
    }),
  action: (id, action, body = {}) => call('POST', `/conversations/${id}/${action}`, body, { background: true, errorHandler: () => {} }),
  settings: (id, changes) => call('POST', `/conversations/${id}/settings`, changes),
  accept: (id) => call('POST', `/conversations/${id}/accept`),
  details: (id, tab, before) => call('GET', `/conversations/${id}/details` + qs({ tab, before }), undefined, { background: true }),
  createGroup: (userIds, name) => call('POST', '/groups', { userIds, name }),
  renameGroup: (id, name) => call('PATCH', `/conversations/${id}`, { name }),
  groupPhoto: (id, file) =>
    file
      ? app.request({ method: 'POST', url: url(`/conversations/${id}/photo`), body: form({ photo: file }), serialize: (raw) => raw })
      : call('DELETE', `/conversations/${id}/photo`),
  addMembers: (id, userIds) => call('POST', `/conversations/${id}/members`, { userIds }),
  removeMember: (id, userId) => call('DELETE', `/conversations/${id}/members/${userId}`),
  edit: (messageId, body) => call('PATCH', `/messages/${messageId}`, { body }),
  remove: (messageId) => call('DELETE', `/messages/${messageId}`),
  react: (messageId, emoji) => call('POST', `/messages/${messageId}/react`, { emoji }),
  pin: (messageId, on) => call('POST', `/messages/${messageId}/pin`, { on }),
  forward: (messageId, conversationIds) => call('POST', `/messages/${messageId}/forward`, { conversationIds }),
  report: (messageId, reason) => call('POST', `/messages/${messageId}/report`, { reason }),
  search: (params) => call('GET', '/search' + qs(params), undefined, { background: true }),
  people: (q) => call('GET', '/people?q=' + encodeURIComponent(q), undefined, { background: true }),
  person: (userId, action, on) => call('POST', `/people/${userId}/${action}`, { on }),
  reports: () => call('GET', '/reports'),
  resolve: (id) => call('POST', `/reports/${id}/resolve`),
  fileUrl: (messageId) => url(`/files/${messageId}`),
  /** Kept for anything that still asks for a picture by its old address. */
  imageUrl: (messageId) => url(`/files/${messageId}`),
};
