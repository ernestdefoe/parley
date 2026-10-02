/*
 * The mockup's own icons, drawn the same way, so the rail and windows match it
 * line for line instead of approximating it with Font Awesome.
 */
const svg = (w, body, attrs = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"') =>
  m.trust(`<svg width="${w}" height="${w}" viewBox="0 0 24 24" ${attrs} aria-hidden="true">${body}</svg>`);

export default {
  phone: () => svg(17, '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>'),
  video: () => svg(18, '<path d="m23 7-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/>'),
  msg: () => svg(17, '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.8-.9L3 21l1.9-5.2A8.4 8.4 0 0 1 12.5 3 8.4 8.4 0 0 1 21 11.5z"/>'),
  min: () => svg(16, '<path d="M5 12h14"/>', 'fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"'),
  x: () => svg(16, '<path d="M18 6 6 18M6 6l12 12"/>', 'fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"'),
  send: () => svg(18, '<path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12 2-12 2z"/>', 'fill="currentColor"'),
  img: () => svg(18, '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>'),
  chev: () => svg(12, '<path d="m6 9 6 6 6-6"/>', 'fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"'),
  search: () => svg(15, '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>', 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"'),
  goto: () => svg(16, '<path d="M5 12h14M13 6l6 6-6 6"/>'),
  more: () => svg(16, '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>', 'fill="currentColor"'),
  expand: () => svg(16, '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>'),
  speaker: () => svg(12, '<path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>'),
  door: () => svg(16, '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>'),
  people: () => svg(16, '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>'),
};
