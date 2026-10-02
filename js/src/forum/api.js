import app from 'flarum/forum/app';

/** Every Parley call, in one place, so the URLs live in one file. */
const url = (path) => app.forum.attribute('apiUrl') + '/parley' + path;

const call = (method, path, body, extra = {}) => app.request({ method, url: url(path), body, ...extra });

export default {
  heartbeat: (body) => call('POST', '/heartbeat', body, { background: true, errorHandler: () => {} }),
  conversations: () => call('GET', '/conversations'),
  open: (userId) => call('POST', '/conversations', { userId }),
  show: (id, params = {}) => {
    const q = new URLSearchParams(params).toString();
    return call('GET', `/conversations/${id}` + (q ? `?${q}` : ''), undefined, params.after ? { background: true, errorHandler: () => {} } : {});
  },
  send: (id, body, replyToId) => call('POST', `/conversations/${id}/messages`, { body, replyToId }),
  upload: (id, file) => {
    const data = new FormData();
    data.append('image', file);
    return app.request({ method: 'POST', url: url(`/conversations/${id}/images`), body: data, serialize: (raw) => raw });
  },
  action: (id, action, body = {}) => call('POST', `/conversations/${id}/${action}`, body, { background: true, errorHandler: () => {} }),
  edit: (messageId, body) => call('PATCH', `/messages/${messageId}`, { body }),
  remove: (messageId) => call('DELETE', `/messages/${messageId}`),
  react: (messageId, emoji) => call('POST', `/messages/${messageId}/react`, { emoji }),
  report: (messageId, reason) => call('POST', `/messages/${messageId}/report`, { reason }),
  people: (q) => call('GET', '/people?q=' + encodeURIComponent(q), undefined, { background: true }),
  person: (userId, action, on) => call('POST', `/people/${userId}/${action}`, { on }),
  reports: () => call('GET', '/reports'),
  resolve: (id) => call('POST', `/reports/${id}/resolve`),
  imageUrl: (messageId) => url(`/images/${messageId}`),
};
