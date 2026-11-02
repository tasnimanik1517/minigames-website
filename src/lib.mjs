import path from 'node:path';

export const env = { preview: false, current: '/' };

export function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Internal URL. In production it is root-relative ("/snake/"). In preview mode (static files opened
 *  without a server) it becomes relative to the current page and points at index.html explicitly. */
export function u(p) {
  if (!env.preview || /^(https?:|mailto:|#|data:)/.test(p)) return p;
  const m = p.match(/^([^?#]*)(.*)$/);
  let target = m[1] || '/';
  const rest = m[2] || '';
  if (target.endsWith('/')) target += 'index.html';
  const fromDir = env.current.endsWith('/') ? env.current : env.current.replace(/[^/]*$/, '');
  let rel = path.posix.relative(fromDir, target);
  if (!rel) rel = './';
  return rel + rest;
}

/** Relative prefix from the current page to the site root (preview mode only). */
export function base() {
  if (!env.preview) return '/';
  const fromDir = env.current.endsWith('/') ? env.current : env.current.replace(/[^/]*$/, '');
  const depth = fromDir.split('/').filter(Boolean).length;
  return depth ? '../'.repeat(depth) : './';
}

export function jsonld(obj) {
  return `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
}

export function fmtDate(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}
